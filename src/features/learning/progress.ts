import "server-only";

import { db } from "@/server/db";
import { recordActivity } from "@/features/learning/activity";
import { checkStreakMilestone, evaluateBadges } from "@/features/engagement/badges";
import { notify } from "@/features/engagement/notify";
import { issueCertificate } from "@/features/certificates/issue";

/**
 * Progress persistence.
 *
 * One implementation, two callers: the Server Action used during normal
 * interaction, and the route handler that `navigator.sendBeacon` hits on page
 * exit. Beacons cannot invoke Server Actions, so the endpoint exists — but the
 * logic must not be duplicated, or the two paths will drift and one of them
 * will start losing progress.
 */

export interface RecordProgressInput {
  userId: string;
  lessonId: string;
  /** Playback position in seconds. Clamped to the lesson's duration. */
  positionSeconds?: number;
  /** Explicit completion. Absent means "leave completion as it is". */
  completed?: boolean;
}

export interface RecordProgressResult {
  ok: boolean;
  percent: number;
  completedLessons: number;
  requiredLessons: number;
  /**
   * True only on the request that moved the course from incomplete to
   * complete. This is what the client uses to fire the celebration, and it is
   * false on every subsequent load — a reload must not re-congratulate you.
   */
  justCompleted: boolean;
  courseComplete: boolean;
}

const EMPTY_RESULT: RecordProgressResult = {
  ok: false,
  percent: 0,
  completedLessons: 0,
  requiredLessons: 0,
  justCompleted: false,
  courseComplete: false,
};

/**
 * Writes a lesson's progress and rolls the course total up.
 *
 * Enrolment is re-checked here rather than trusted from the caller: this runs
 * from a public route handler as well as an action, and a beacon is trivially
 * forgeable.
 */
export async function recordProgress(input: RecordProgressInput): Promise<RecordProgressResult> {
  const lesson = await db.lesson.findUnique({
    where: { id: input.lessonId },
    select: {
      id: true,
      courseId: true,
      durationSeconds: true,
      course: { select: { id: true, status: true, deletedAt: true } },
    },
  });

  if (!lesson || lesson.course.deletedAt || lesson.course.status !== "PUBLISHED") {
    return EMPTY_RESULT;
  }

  const [enrollment, learner] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId: input.userId, courseId: lesson.courseId } },
      select: { id: true, status: true, expiresAt: true },
    }),
    db.user.findUnique({ where: { id: input.userId }, select: { timezone: true } }),
  ]);

  const usable =
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date());

  if (!usable) return EMPTY_RESULT;

  // A position beyond the lesson length is meaningless and would make the
  // resume banner offer a timestamp that does not exist.
  const position =
    input.positionSeconds === undefined
      ? undefined
      : Math.max(0, Math.min(Math.floor(input.positionSeconds), lesson.durationSeconds || 0));

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: input.userId, lessonId: lesson.id } },
      select: { completed: true, positionSeconds: true },
    });

    const nowCompleted = input.completed ?? existing?.completed ?? false;

    // Never rewind. Two devices, or a late-arriving beacon, must not drag the
    // resume point backwards past where the learner actually got to.
    const nextPosition =
      position === undefined
        ? (existing?.positionSeconds ?? 0)
        : Math.max(position, existing?.positionSeconds ?? 0);

    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId: input.userId, lessonId: lesson.id } },
      create: {
        userId: input.userId,
        lessonId: lesson.id,
        positionSeconds: nextPosition,
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date() : null,
        lastViewedAt: new Date(),
      },
      update: {
        positionSeconds: nextPosition,
        completed: nowCompleted,
        // Preserve the original completion timestamp on re-saves.
        completedAt: nowCompleted ? (existing?.completed ? undefined : new Date()) : null,
        lastViewedAt: new Date(),
      },
    });

    // --- roll the course total up -----------------------------------------
    const [requiredLessons, completedRequired, totalLessons, completedAny] = await Promise.all([
      tx.lesson.count({ where: { courseId: lesson.courseId, isRequired: true } }),
      tx.lessonProgress.count({
        where: {
          userId: input.userId,
          completed: true,
          lesson: { courseId: lesson.courseId, isRequired: true },
        },
      }),
      tx.lesson.count({ where: { courseId: lesson.courseId } }),
      tx.lessonProgress.count({
        where: { userId: input.userId, completed: true, lesson: { courseId: lesson.courseId } },
      }),
    ]);

    const percent =
      requiredLessons === 0 ? 0 : Math.round((completedRequired / requiredLessons) * 100);

    await tx.courseProgress.upsert({
      where: { enrollmentId: enrollment.id },
      create: {
        enrollmentId: enrollment.id,
        completedLessons: completedAny,
        totalLessons,
        percent,
        lastLessonId: lesson.id,
        lastActivityAt: new Date(),
      },
      update: {
        completedLessons: completedAny,
        totalLessons,
        percent,
        lastLessonId: lesson.id,
        lastActivityAt: new Date(),
      },
    });

    // Activity is written inside this transaction, so a day cannot be marked
    // active without the progress that made it so.
    const newlyCompleted = nowCompleted && !existing?.completed;

    // Minutes come from how far the position actually moved, not from the
    // fact that a save happened. The player checkpoints roughly every 15
    // seconds, so counting one minute per save inflated real study time by
    // about four times.
    const watchedSeconds =
      position === undefined ? 0 : Math.max(0, position - (existing?.positionSeconds ?? 0));

    await recordActivity(tx, {
      userId: input.userId,
      timezone: learner?.timezone ?? "UTC",
      minutesLearned: Math.round(watchedSeconds / 60),
      secondsLearned: watchedSeconds,
      completedLesson: newlyCompleted,
    });

    // --- completion transition --------------------------------------------
    const shouldBeComplete = requiredLessons > 0 && completedRequired >= requiredLessons;
    const wasComplete = enrollment.status === "COMPLETED";
    const justCompleted = shouldBeComplete && !wasComplete;

    if (justCompleted) {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          action: "UPDATE",
          entityType: "Enrollment",
          entityId: enrollment.id,
          metadata: { event: "course_completed", courseId: lesson.courseId },
        },
      });

      // The certificate is minted in the same transaction as the completion
      // that earned it. This is the only place in the application that creates
      // one — there is no action, endpoint or form a learner can call.
      const certificate = await issueCertificate(tx, {
        userId: input.userId,
        courseId: lesson.courseId,
      });

      await notify(
        {
          userId: input.userId,
          type: "CERTIFICATE_ISSUED",
          title: "Course complete",
          body: certificate
            ? "Every required lesson is done. Your certificate is ready."
            : "Every required lesson is done.",
          href: certificate ? `/certificates/${certificate.serial}` : "/dashboard/certificates",
          dedupeKey: `course-complete:${lesson.courseId}`,
        },
        tx,
      );
    } else if (!shouldBeComplete && wasComplete) {
      // Un-completing a lesson reopens the course. The certificate, once
      // issued, is deliberately left alone — it recorded a fact that was true.
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "ACTIVE", completedAt: null },
      });
    }

    return {
      ok: true,
      percent,
      completedLessons: completedAny,
      requiredLessons,
      justCompleted,
      courseComplete: shouldBeComplete,
    };
  });

  // Badges and milestones are evaluated after the transaction commits. They
  // read counts rather than reacting to this specific event, so nothing is
  // missed if one evaluation fails — the next qualifying action picks it up.
  // A failure here must never fail the progress write that already succeeded.
  if (result.ok) {
    try {
      await evaluateBadges(input.userId);
      const streak = await db.streak.findUnique({
        where: { userId: input.userId },
        select: { currentDays: true },
      });
      if (streak) await checkStreakMilestone(input.userId, streak.currentDays);
    } catch (error) {
      console.error("[progress] badge evaluation failed", error);
    }
  }

  return result;
}
