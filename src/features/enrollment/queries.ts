import "server-only";

import { cache } from "react";

import { db } from "@/server/db";
import { getSessionUser } from "@/server/authz";

/**
 * What the course page needs to know about the viewer's relationship to a
 * course: are they enrolled, and is it on their wishlist.
 *
 * One query, memoised per request, because the hero CTA, the sticky purchase
 * card and the wishlist heart all ask the same question.
 */

export interface CourseViewerState {
  isAuthenticated: boolean;
  isEnrolled: boolean;
  isWishlisted: boolean;
  /** Percent complete, when enrolled. Drives the "continue" copy. */
  progressPercent: number;
  /** True when the viewer owns or co-teaches this course. */
  isInstructor: boolean;
}

export const getCourseViewerState = cache(async (courseId: string): Promise<CourseViewerState> => {
  const user = await getSessionUser();

  if (!user) {
    return {
      isAuthenticated: false,
      isEnrolled: false,
      isWishlisted: false,
      progressPercent: 0,
      isInstructor: false,
    };
  }

  const [enrollment, wishlist, teaching] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: {
        status: true,
        expiresAt: true,
        progress: { select: { percent: true } },
      },
    }),
    db.wishlist.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { id: true },
    }),
    db.courseInstructor.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
      select: { id: true },
    }),
  ]);

  // A REFUNDED or CANCELLED row exists but grants nothing, and an expired
  // enrolment is no enrolment — same rule as `verifyEnrollment`.
  const isEnrolled = Boolean(
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date()),
  );

  return {
    isAuthenticated: true,
    isEnrolled,
    isWishlisted: Boolean(wishlist),
    progressPercent: enrollment?.progress?.percent ?? 0,
    isInstructor: Boolean(teaching),
  };
});

export interface WishlistEntry {
  id: string;
  addedAt: string;
  courseId: string;
}

/** Course ids on the viewer's wishlist, for marking cards in a listing. */
export async function getWishlistedCourseIds(): Promise<Set<string>> {
  const user = await getSessionUser();
  if (!user) return new Set();

  const rows = await db.wishlist.findMany({
    where: { userId: user.id },
    select: { courseId: true },
  });

  return new Set(rows.map((row) => row.courseId));
}
