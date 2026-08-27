import "server-only";

import { db } from "@/server/db";
import { requireAuth } from "@/server/authz";
import type { CourseSummary } from "@/features/catalog/types";

/**
 * The viewer's saved courses.
 *
 * Enrolment status comes back with each row so the list can show "Continue"
 * on something the learner has since bought, rather than offering to sell it
 * to them again.
 */
export interface WishlistItem {
  course: CourseSummary;
  addedAt: string;
  isEnrolled: boolean;
}

export async function getWishlist(): Promise<WishlistItem[]> {
  const user = await requireAuth();

  const rows = await db.wishlist.findMany({
    where: { userId: user.id, course: { status: "PUBLISHED", deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          subtitle: true,
          thumbnailUrl: true,
          level: true,
          language: true,
          priceAmount: true,
          compareAtAmount: true,
          currency: true,
          ratingAvg: true,
          ratingCount: true,
          enrollmentCount: true,
          lessonCount: true,
          durationMinutes: true,
          isBestseller: true,
          updatedAt: true,
          category: { select: { slug: true, name: true } },
          tags: { select: { slug: true, name: true }, orderBy: { name: "asc" } },
          instructors: {
            where: { role: "OWNER" },
            take: 1,
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  profile: { select: { avatarUrl: true } },
                  instructorProfile: { select: { slug: true } },
                },
              },
            },
          },
          enrollments: {
            where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const owner = row.course.instructors[0]?.user;
    return {
      addedAt: row.createdAt.toISOString(),
      isEnrolled: row.course.enrollments.length > 0,
      course: {
        id: row.course.id,
        slug: row.course.slug,
        title: row.course.title,
        subtitle: row.course.subtitle,
        thumbnailUrl: row.course.thumbnailUrl,
        level: row.course.level,
        language: row.course.language,
        category: row.course.category,
        tags: row.course.tags.map((tag) => tag.name),
        tagSlugs: row.course.tags.map((tag) => tag.slug),
        instructor: {
          id: owner?.id ?? "",
          slug: owner?.instructorProfile?.slug ?? "",
          name: owner?.name ?? "Coursera",
          avatarUrl: owner?.profile?.avatarUrl ?? null,
        },
        priceAmount: row.course.priceAmount,
        compareAtAmount: row.course.compareAtAmount,
        currency: row.course.currency,
        ratingAvg: row.course.ratingAvg,
        ratingCount: row.course.ratingCount,
        enrollmentCount: row.course.enrollmentCount,
        lessonCount: row.course.lessonCount,
        durationMinutes: row.course.durationMinutes,
        isBestseller: row.course.isBestseller,
        updatedAt: row.course.updatedAt.toISOString(),
      },
    };
  });
}
