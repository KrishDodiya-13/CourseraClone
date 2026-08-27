import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { generateSerial } from "@/lib/certificate-serial";

/**
 * Certificate issuance.
 *
 * This is the only code in the application that creates a `Certificate` row.
 * There is no Server Action, no route handler and no form that reaches it —
 * issuance happens inside the transaction that marks an enrolment complete,
 * and nowhere else. A learner cannot ask for a certificate; they can only
 * finish a course.
 *
 * Eligibility is re-derived here from the lesson rows rather than trusted from
 * the caller, because this function is the last gate before a credential
 * exists.
 */

export interface IssuedCertificate {
  id: string;
  serial: string;
  alreadyExisted: boolean;
}

/**
 * Issues a certificate for a completed course.
 *
 * Takes a transaction client so the credential and the completion that earned
 * it commit together — a certificate must never survive a rolled-back
 * completion, and a completion should not silently lack its certificate.
 *
 * Idempotent: the unique constraint on (userId, courseId) means a re-run
 * returns the existing certificate rather than minting a second one.
 */
export async function issueCertificate(
  tx: Prisma.TransactionClient,
  input: { userId: string; courseId: string },
): Promise<IssuedCertificate | null> {
  const existing = await tx.certificate.findUnique({
    where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    select: { id: true, serial: true },
  });

  if (existing) {
    return { id: existing.id, serial: existing.serial, alreadyExisted: true };
  }

  // --- eligibility, re-derived ------------------------------------------
  const enrollment = await tx.enrollment.findUnique({
    where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
    select: { status: true },
  });

  if (!enrollment || enrollment.status !== "COMPLETED") return null;

  const [requiredLessons, completedRequired] = await Promise.all([
    tx.lesson.count({ where: { courseId: input.courseId, isRequired: true } }),
    tx.lessonProgress.count({
      where: {
        userId: input.userId,
        completed: true,
        lesson: { courseId: input.courseId, isRequired: true },
      },
    }),
  ]);

  // A course with no required lessons cannot be "completed" in any meaningful
  // sense, so it does not earn a credential either.
  if (requiredLessons === 0 || completedRequired < requiredLessons) return null;

  // --- snapshots ---------------------------------------------------------
  const [user, course] = await Promise.all([
    tx.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    tx.course.findUnique({
      where: { id: input.courseId },
      select: {
        title: true,
        instructors: {
          where: { role: "OWNER" },
          take: 1,
          select: { user: { select: { name: true } } },
        },
      },
    }),
  ]);

  if (!user || !course) return null;

  try {
    const certificate = await tx.certificate.create({
      data: {
        userId: input.userId,
        courseId: input.courseId,
        serial: generateSerial(),
        // Snapshots, not live joins. A renamed course, a renamed learner or a
        // change of instructor must not alter a credential already issued.
        courseTitleSnapshot: course.title,
        recipientNameSnapshot: user.name,
        instructorNameSnapshot: course.instructors[0]?.user.name ?? "Coursera",
      },
      select: { id: true, serial: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: "CREATE",
        entityType: "Certificate",
        entityId: certificate.id,
        metadata: { courseId: input.courseId, serial: certificate.serial },
      },
    });

    return { id: certificate.id, serial: certificate.serial, alreadyExisted: false };
  } catch (error) {
    // Two concurrent completions racing. The unique constraint settles it;
    // whichever lost simply reads back the winner's certificate.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const winner = await tx.certificate.findUnique({
        where: { userId_courseId: { userId: input.userId, courseId: input.courseId } },
        select: { id: true, serial: true },
      });
      return winner ? { ...winner, alreadyExisted: true } : null;
    }
    throw error;
  }
}

/**
 * Backfills certificates for completions that predate issuance existing.
 *
 * Used by the seed and available for a one-off repair. It goes through the
 * same eligibility check as live issuance, so it cannot mint a credential for
 * a course that was not actually finished.
 */
export async function backfillCertificates(): Promise<number> {
  const completed = await db.enrollment.findMany({
    where: { status: "COMPLETED" },
    select: { userId: true, courseId: true },
  });

  let issued = 0;
  for (const enrollment of completed) {
    const result = await db.$transaction((tx) => issueCertificate(tx, enrollment));
    if (result && !result.alreadyExisted) issued += 1;
  }
  return issued;
}
