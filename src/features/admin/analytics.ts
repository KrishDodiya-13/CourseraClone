import "server-only";

import { db } from "@/server/db";

/**
 * Platform analytics.
 *
 * Every figure here is computed from the tables that own it, not read from a
 * denormalised counter. That is slower and entirely deliberate: the counters
 * exist to make the *public* pages fast, and a reporting page that repeats
 * whatever the counter says would hide exactly the drift a report is for.
 *
 * Where a metric can be defined more than one way, the definition is stated
 * next to it — an unlabelled "completion rate" is a number nobody can act on.
 */

export interface PlatformMetrics {
  users: {
    total: number;
    students: number;
    instructors: number;
    admins: number;
    suspended: number;
    verified: number;
    newLast30Days: number;
    newPrevious30Days: number;
  };
  courses: {
    total: number;
    published: number;
    inReview: number;
    draft: number;
    rejected: number;
    archived: number;
    free: number;
    paid: number;
    averageRating: number;
    totalLessons: number;
  };
  learning: {
    enrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    /**
     * Completed ÷ (active + completed), as a percentage.
     *
     * Refunded and cancelled enrolments are excluded from both sides: someone
     * who was refunded never had the chance to finish, so counting them as a
     * failure to complete would understate the figure without meaning anything.
     */
    completionRate: number;
    /** Mean progress across enrolments that are still live, 0-100. */
    averageProgress: number;
    certificatesIssued: number;
    learnersActiveLast7Days: number;
  };
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    students,
    instructors,
    admins,
    suspended,
    verified,
    newUsers,
    priorNewUsers,
    totalCourses,
    published,
    inReview,
    draft,
    rejected,
    archived,
    freeCourses,
    ratingAggregate,
    lessonCount,
    enrollments,
    activeEnrollments,
    completedEnrollments,
    progressAggregate,
    certificates,
    activeLearners,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "INSTRUCTOR" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.user.count({ where: { emailVerified: { not: null } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.course.count(),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.course.count({ where: { status: "IN_REVIEW" } }),
    db.course.count({ where: { status: "DRAFT" } }),
    db.course.count({ where: { status: "REJECTED" } }),
    db.course.count({ where: { status: "ARCHIVED" } }),
    db.course.count({ where: { priceAmount: 0 } }),
    // Only rated courses count towards the average; folding in unrated ones
    // as zero would drag the platform rating towards nothing as it grows.
    db.course.aggregate({ where: { ratingCount: { gt: 0 } }, _avg: { ratingAvg: true } }),
    db.lesson.count(),
    db.enrollment.count(),
    db.enrollment.count({ where: { status: "ACTIVE" } }),
    db.enrollment.count({ where: { status: "COMPLETED" } }),
    db.courseProgress.aggregate({
      where: { enrollment: { status: { in: ["ACTIVE", "COMPLETED"] } } },
      _avg: { percent: true },
    }),
    db.certificate.count(),
    db.learningActivity
      .findMany({
        where: { date: { gte: sevenDaysAgo } },
        distinct: ["userId"],
        select: { userId: true },
      })
      .then((rows) => rows.length),
  ]);

  const finishable = activeEnrollments + completedEnrollments;

  return {
    users: {
      total: totalUsers,
      students,
      instructors,
      admins,
      suspended,
      verified,
      newLast30Days: newUsers,
      newPrevious30Days: priorNewUsers,
    },
    courses: {
      total: totalCourses,
      published,
      inReview,
      draft,
      rejected,
      archived,
      free: freeCourses,
      paid: totalCourses - freeCourses,
      averageRating: Number((ratingAggregate._avg.ratingAvg ?? 0).toFixed(2)),
      totalLessons: lessonCount,
    },
    learning: {
      enrollments,
      activeEnrollments,
      completedEnrollments,
      completionRate: finishable === 0 ? 0 : Math.round((completedEnrollments / finishable) * 100),
      averageProgress: Math.round(progressAggregate._avg.percent ?? 0),
      certificatesIssued: certificates,
      learnersActiveLast7Days: activeLearners,
    },
  };
}

export interface SignupPoint {
  date: string;
  users: number;
  enrollments: number;
}

/**
 * Daily signups and enrolments for the last N days.
 *
 * Days with no activity are filled in with zeroes rather than skipped — a
 * sparse series drawn as a line silently redraws a quiet week as a busy one.
 */
export async function getDailySeries(days = 30): Promise<SignupPoint[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [users, enrollments] = await Promise.all([
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.enrollment.findMany({
      where: { enrolledAt: { gte: since } },
      select: { enrolledAt: true },
    }),
  ]);

  const buckets = new Map<string, { users: number; enrollments: number }>();
  for (let index = 0; index < days; index += 1) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + index);
    buckets.set(day.toISOString().slice(0, 10), { users: 0, enrollments: 0 });
  }

  for (const user of users) {
    const key = user.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.users += 1;
  }

  for (const enrollment of enrollments) {
    const key = enrollment.enrolledAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.enrollments += 1;
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

export interface CategoryPerformance {
  id: string;
  name: string;
  courses: number;
  enrollments: number;
  completionRate: number;
}

/** Where the learning actually happens, by category. */
export async function getCategoryPerformance(): Promise<CategoryPerformance[]> {
  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { courses: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  });

  const [enrolled, completed] = await Promise.all([
    db.enrollment.groupBy({
      by: ["courseId"],
      where: { status: { in: ["ACTIVE", "COMPLETED"] } },
      _count: { _all: true },
    }),
    db.enrollment.groupBy({
      by: ["courseId"],
      where: { status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const courseCategory = new Map(
    (await db.course.findMany({ select: { id: true, categoryId: true } })).map((course) => [
      course.id,
      course.categoryId,
    ]),
  );

  const totals = new Map<string, { enrolled: number; completed: number }>();
  const bump = (courseId: string, key: "enrolled" | "completed", amount: number) => {
    const categoryId = courseCategory.get(courseId);
    if (!categoryId) return;
    const entry = totals.get(categoryId) ?? { enrolled: 0, completed: 0 };
    entry[key] += amount;
    totals.set(categoryId, entry);
  };

  for (const row of enrolled) bump(row.courseId, "enrolled", row._count._all);
  for (const row of completed) bump(row.courseId, "completed", row._count._all);

  return categories.map((category) => {
    const entry = totals.get(category.id) ?? { enrolled: 0, completed: 0 };
    return {
      id: category.id,
      name: category.name,
      courses: category._count.courses,
      enrollments: entry.enrolled,
      completionRate:
        entry.enrolled === 0 ? 0 : Math.round((entry.completed / entry.enrolled) * 100),
    };
  });
}
