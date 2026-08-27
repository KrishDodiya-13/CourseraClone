"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/server/db";
import { assertAuth, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";
import { notify } from "@/features/engagement/notify";

/**
 * Enrolment.
 *
 * The rule this module exists to hold, carried from Phase 0: an enrolment is
 * only ever created by a verified payment or by an explicitly free course.
 * There is no code path here that enrols someone in a paid course — that
 * arrives in Phase 11 behind a signature-verified webhook, and the paid branch
 * below deliberately hands off to checkout instead.
 */

export interface EnrollResult {
  ok: boolean;
  message?: string;
  /** Where the caller should send the user next, when relevant. */
  redirectTo?: string;
}

const courseIdSchema = z.object({ courseId: z.string().min(1) });

export async function enrollInCourseAction(
  _previous: EnrollResult | null,
  formData: FormData,
): Promise<EnrollResult> {
  const parsed = courseIdSchema.safeParse({ courseId: formData.get("courseId") });
  if (!parsed.success) {
    return { ok: false, message: "That course reference is not valid." };
  }

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Guests are sent to sign in rather than silently refused.
      return { ok: false, redirectTo: routes.login };
    }
    throw error;
  }

  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: {
      id: true,
      slug: true,
      status: true,
      deletedAt: true,
      priceAmount: true,
    },
  });

  // An unpublished, archived or soft-deleted course is treated exactly like a
  // course that does not exist — no distinction is leaked to the caller.
  if (!course || course.deletedAt || course.status !== "PUBLISHED") {
    return { ok: false, message: "That course is not available." };
  }

  // Paid courses never enrol here. Phase 11 creates the order, takes payment,
  // and the webhook creates the enrolment inside a transaction.
  if (course.priceAmount > 0) {
    return { ok: false, redirectTo: `${routes.checkout}?course=${course.slug}` };
  }

  const existing = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true, status: true },
  });

  if (existing) {
    // Re-enrolling is not an error worth shouting about — the user already has
    // what they wanted, so send them to it. A previously cancelled enrolment
    // is reactivated rather than duplicated.
    if (existing.status === "CANCELLED") {
      await db.enrollment.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", enrolledAt: new Date() },
      });
    }
    return { ok: true, redirectTo: routes.learn(course.slug) };
  }

  try {
    await db.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          status: "ACTIVE",
          source: "FREE",
        },
        select: { id: true },
      });

      const lessonCount = await tx.lesson.count({ where: { courseId: course.id } });

      await tx.courseProgress.create({
        data: {
          enrollmentId: enrollment.id,
          totalLessons: lessonCount,
          completedLessons: 0,
          percent: 0,
        },
      });

      // The denormalised count is maintained in the same transaction, so the
      // catalogue can never show a figure the enrolment table disagrees with.
      await tx.course.update({
        where: { id: course.id },
        data: { enrollmentCount: { increment: 1 } },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "CREATE",
          entityType: "Enrollment",
          entityId: enrollment.id,
          metadata: { courseId: course.id, source: "FREE" },
        },
      });

      await notify(
        {
          userId: user.id,
          type: "ENROLMENT_CONFIRMED",
          title: "You are enrolled",
          body: "Your place is confirmed. Pick up wherever you like.",
          href: routes.learn(course.slug),
          dedupeKey: `enrolled:${course.id}`,
        },
        tx,
      );
    });
  } catch (error) {
    // The unique constraint on (userId, courseId) is the real guard against a
    // double-submit — two concurrent requests cannot both win. Losing that
    // race is not a failure from the user's point of view.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return { ok: true, redirectTo: routes.learn(course.slug) };
    }
    throw error;
  }

  revalidatePath(routes.course(course.slug));
  revalidatePath(routes.dashboard);

  return { ok: true, redirectTo: routes.learn(course.slug) };
}

/**
 * Form-action wrapper that performs the redirect server-side.
 *
 * Used by the plain `<form action={...}>` on the course page, so enrolment
 * works without JavaScript.
 */
export async function enrollAndRedirectAction(formData: FormData): Promise<void> {
  const result = await enrollInCourseAction(null, formData);
  if (result.redirectTo) redirect(result.redirectTo);
}
