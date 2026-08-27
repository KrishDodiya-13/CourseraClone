import "server-only";

import { cache } from "react";

import { db } from "@/server/db";
import { localDateKey } from "@/features/learning/activity";

/**
 * Dashboard and profile reads.
 *
 * Every figure on these pages is derived from the authenticated user's own
 * rows. Nothing is a placeholder, a constant, or computed in the browser —
 * which is why an account with no activity shows honest zeros rather than
 * decorative numbers.
 */

/* -------------------------------------------------------------------------- */
/*  Enrolled courses                                                          */
/* -------------------------------------------------------------------------- */

export interface EnrolledCourse {
  enrollmentId: string;
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  categoryName: string;
  categorySlug: string;
  instructorName: string;
  instructorAvatarUrl: string | null;

  status: "ACTIVE" | "COMPLETED" | "REFUNDED" | "CANCELLED";
  percent: number;
  completedLessons: number;
  totalLessons: number;
  /** ISO 8601. */
  enrolledAt: string;
  completedAt: string | null;
  lastActivityAt: string | null;
  /** Where "continue" should land. */
  nextLessonId: string | null;
  certificateSerial: string | null;
}

export const getEnrolledCourses = cache(async (userId: string): Promise<EnrolledCourse[]> => {
  const rows = await db.enrollment.findMany({
    where: { userId, course: { deletedAt: null } },
    orderBy: [{ progress: { lastActivityAt: "desc" } }, { enrolledAt: "desc" }],
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      completedAt: true,
      courseId: true,
      progress: {
        select: {
          percent: true,
          completedLessons: true,
          totalLessons: true,
          lastActivityAt: true,
          lastLessonId: true,
        },
      },
      course: {
        select: {
          slug: true,
          title: true,
          subtitle: true,
          thumbnailUrl: true,
          lessonCount: true,
          category: { select: { name: true, slug: true } },
          instructors: {
            where: { role: "OWNER" },
            take: 1,
            select: {
              user: {
                select: { name: true, profile: { select: { avatarUrl: true } } },
              },
            },
          },
          lessons: {
            orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
            select: { id: true, progress: { where: { userId }, select: { completed: true } } },
          },
          certificates: { where: { userId }, select: { serial: true }, take: 1 },
        },
      },
    },
  });

  return rows.map((row) => {
    const owner = row.course.instructors[0]?.user;

    // "Continue" should land on the first lesson still to do, falling back to
    // wherever they were last, then the start.
    const firstIncomplete = row.course.lessons.find((lesson) => !lesson.progress[0]?.completed)?.id;

    return {
      enrollmentId: row.id,
      courseId: row.courseId,
      slug: row.course.slug,
      title: row.course.title,
      subtitle: row.course.subtitle,
      thumbnailUrl: row.course.thumbnailUrl,
      categoryName: row.course.category.name,
      categorySlug: row.course.category.slug,
      instructorName: owner?.name ?? "Coursera",
      instructorAvatarUrl: owner?.profile?.avatarUrl ?? null,
      status: row.status,
      percent: row.progress?.percent ?? 0,
      completedLessons: row.progress?.completedLessons ?? 0,
      totalLessons: row.progress?.totalLessons ?? row.course.lessonCount,
      enrolledAt: row.enrolledAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      lastActivityAt: row.progress?.lastActivityAt?.toISOString() ?? null,
      nextLessonId:
        firstIncomplete ?? row.progress?.lastLessonId ?? row.course.lessons[0]?.id ?? null,
      certificateSerial: row.course.certificates[0]?.serial ?? null,
    };
  });
});

/** The single course to resume — most recently touched and unfinished. */
export const getContinueLearning = cache(async (userId: string) => {
  const courses = await getEnrolledCourses(userId);
  return (
    courses.find((course) => course.status === "ACTIVE" && course.percent < 100) ??
    courses.find((course) => course.status === "ACTIVE") ??
    null
  );
});

/* -------------------------------------------------------------------------- */
/*  Certificates                                                              */
/* -------------------------------------------------------------------------- */

export interface CertificateView {
  id: string;
  serial: string;
  courseTitle: string;
  courseSlug: string;
  recipientName: string;
  issuedAt: string;
  revokedAt: string | null;
  /** For the card thumbnail — the course's current image, not a snapshot. */
  courseThumbnailUrl: string | null;
  /** The course's owning instructor, shown the way the reference design
   *  shows a "provider" (Microsoft, Google, IBM…) under the thumbnail. */
  providerName: string | null;
}

export const getCertificates = cache(async (userId: string): Promise<CertificateView[]> => {
  const rows = await db.certificate.findMany({
    where: { userId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      serial: true,
      courseTitleSnapshot: true,
      recipientNameSnapshot: true,
      issuedAt: true,
      revokedAt: true,
      course: {
        select: {
          slug: true,
          thumbnailUrl: true,
          instructors: {
            where: { role: "OWNER" },
            take: 1,
            select: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    serial: row.serial,
    // The snapshot, not the live title — a certificate records what was true
    // when it was issued.
    courseTitle: row.courseTitleSnapshot,
    courseSlug: row.course.slug,
    recipientName: row.recipientNameSnapshot,
    issuedAt: row.issuedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    courseThumbnailUrl: row.course.thumbnailUrl,
    providerName: row.course.instructors[0]?.user.name ?? null,
  }));
});

/* -------------------------------------------------------------------------- */
/*  Activity & statistics                                                     */
/* -------------------------------------------------------------------------- */

export interface ActivityDay {
  /** `YYYY-MM-DD`. */
  date: string;
  minutesLearned: number;
  lessonsCompleted: number;
}

export interface LearningStats {
  enrolledCount: number;
  activeCount: number;
  completedCount: number;
  certificateCount: number;
  wishlistCount: number;
  lessonsCompleted: number;
  minutesLearned: number;
  currentStreak: number;
  longestStreak: number;
  /** Days with any recorded activity, in the window below. */
  activeDays: number;
  badgeCount: number;
}

export const getLearningStats = cache(async (userId: string): Promise<LearningStats> => {
  const [
    enrollments,
    completedEnrollments,
    certificates,
    wishlist,
    lessonsCompleted,
    activity,
    streak,
    badges,
  ] = await Promise.all([
    db.enrollment.count({ where: { userId, course: { deletedAt: null } } }),
    db.enrollment.count({ where: { userId, status: "COMPLETED" } }),
    db.certificate.count({ where: { userId, revokedAt: null } }),
    db.wishlist.count({ where: { userId } }),
    db.lessonProgress.count({ where: { userId, completed: true } }),
    db.learningActivity.aggregate({
      where: { userId },
      _sum: { minutesLearned: true },
      _count: true,
    }),
    db.streak.findUnique({
      where: { userId },
      select: { currentDays: true, longestDays: true },
    }),
    db.userBadge.count({ where: { userId } }),
  ]);

  return {
    enrolledCount: enrollments,
    activeCount: enrollments - completedEnrollments,
    completedCount: completedEnrollments,
    certificateCount: certificates,
    wishlistCount: wishlist,
    lessonsCompleted,
    minutesLearned: activity._sum.minutesLearned ?? 0,
    currentStreak: streak?.currentDays ?? 0,
    longestStreak: streak?.longestDays ?? 0,
    activeDays: activity._count,
    badgeCount: badges,
  };
});

/**
 * Daily activity for the heatmap.
 *
 * Returns a dense series — every day in the window, including the empty ones —
 * because a calendar with gaps silently collapses and misrepresents a streak.
 */
export const getActivityCalendar = cache(
  async (userId: string, days = 182): Promise<ActivityDay[]> => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const timezone = user?.timezone ?? "UTC";

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const rows = await db.learningActivity.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { date: true, minutesLearned: true, lessonsCompleted: true },
    });

    const byDate = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));

    const todayKey = localDateKey(new Date(), timezone);
    const calendar: ActivityDay[] = [];
    const cursor = new Date(`${todayKey}T00:00:00.000Z`);
    cursor.setUTCDate(cursor.getUTCDate() - (days - 1));

    for (let index = 0; index < days; index += 1) {
      const key = cursor.toISOString().slice(0, 10);
      const found = byDate.get(key);
      calendar.push({
        date: key,
        minutesLearned: found?.minutesLearned ?? 0,
        lessonsCompleted: found?.lessonsCompleted ?? 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return calendar;
  },
);

export interface ActivityEvent {
  id: string;
  kind: "lesson" | "course" | "certificate" | "quiz" | "badge";
  title: string;
  detail: string | null;
  href: string | null;
  at: string;
}

/**
 * Recent activity, merged from the places it actually happens.
 *
 * There is no single events table — inventing one would mean a second source of
 * truth that can drift from the rows it describes. Merging at read time is a
 * few more queries and always agrees with reality.
 */
export const getRecentActivity = cache(
  async (userId: string, limit = 12): Promise<ActivityEvent[]> => {
    const [lessons, completions, certificates, attempts, badges] = await Promise.all([
      db.lessonProgress.findMany({
        where: { userId, completed: true },
        orderBy: { completedAt: "desc" },
        take: limit,
        select: {
          id: true,
          completedAt: true,
          lesson: {
            select: { title: true, course: { select: { title: true, slug: true } } },
          },
        },
      }),
      db.enrollment.findMany({
        where: { userId, status: "COMPLETED", completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: limit,
        select: {
          id: true,
          completedAt: true,
          course: { select: { title: true, slug: true } },
        },
      }),
      db.certificate.findMany({
        where: { userId },
        orderBy: { issuedAt: "desc" },
        take: limit,
        select: { id: true, issuedAt: true, courseTitleSnapshot: true, serial: true },
      }),
      db.quizAttempt.findMany({
        where: { userId, status: "GRADED" },
        orderBy: { gradedAt: "desc" },
        take: limit,
        select: {
          id: true,
          gradedAt: true,
          score: true,
          maxScore: true,
          passed: true,
          quiz: { select: { title: true } },
        },
      }),
      db.userBadge.findMany({
        where: { userId },
        orderBy: { awardedAt: "desc" },
        take: limit,
        select: { id: true, awardedAt: true, badge: { select: { name: true, description: true } } },
      }),
    ]);

    const events: ActivityEvent[] = [
      ...lessons.map((row) => ({
        id: `lesson-${row.id}`,
        kind: "lesson" as const,
        title: row.lesson.title,
        detail: row.lesson.course.title,
        href: `/learn/${row.lesson.course.slug}`,
        at: (row.completedAt ?? new Date()).toISOString(),
      })),
      ...completions.map((row) => ({
        id: `course-${row.id}`,
        kind: "course" as const,
        title: `Finished ${row.course.title}`,
        detail: null,
        href: `/courses/${row.course.slug}`,
        at: (row.completedAt ?? new Date()).toISOString(),
      })),
      ...certificates.map((row) => ({
        id: `cert-${row.id}`,
        kind: "certificate" as const,
        title: `Certificate issued`,
        detail: row.courseTitleSnapshot,
        href: `/dashboard/certificates`,
        at: row.issuedAt.toISOString(),
      })),
      ...attempts.map((row) => ({
        id: `quiz-${row.id}`,
        kind: "quiz" as const,
        title: row.passed ? `Passed ${row.quiz.title}` : `Attempted ${row.quiz.title}`,
        detail: `${row.score}/${row.maxScore}`,
        href: null,
        at: (row.gradedAt ?? new Date()).toISOString(),
      })),
      ...badges.map((row) => ({
        id: `badge-${row.id}`,
        kind: "badge" as const,
        title: `Earned ${row.badge.name}`,
        detail: row.badge.description,
        href: "/profile",
        at: row.awardedAt.toISOString(),
      })),
    ];

    return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
  },
);

/* -------------------------------------------------------------------------- */
/*  Profile                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProfileView {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  joinedAt: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  timezone: string;
  badges: Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
    awardedAt: string;
  }>;
}

export const getProfile = cache(async (userId: string): Promise<ProfileView | null> => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      timezone: true,
      profile: {
        select: {
          avatarUrl: true,
          headline: true,
          bio: true,
          location: true,
          websiteUrl: true,
        },
      },
      badges: {
        orderBy: { awardedAt: "desc" },
        select: {
          id: true,
          awardedAt: true,
          badge: {
            select: { slug: true, name: true, description: true, tier: true },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    joinedAt: user.createdAt.toISOString(),
    avatarUrl: user.profile?.avatarUrl ?? null,
    headline: user.profile?.headline ?? null,
    bio: user.profile?.bio ?? null,
    location: user.profile?.location ?? null,
    websiteUrl: user.profile?.websiteUrl ?? null,
    timezone: user.timezone,
    badges: user.badges.map((row) => ({
      id: row.id,
      slug: row.badge.slug,
      name: row.badge.name,
      description: row.badge.description,
      tier: row.badge.tier,
      awardedAt: row.awardedAt.toISOString(),
    })),
  };
});

/** Badges not yet earned, so the profile can show what is available. */
export const getUnearnedBadges = cache(async (userId: string) => {
  return db.badge.findMany({
    where: { awardedTo: { none: { userId } } },
    orderBy: { tier: "asc" },
    select: { id: true, slug: true, name: true, description: true, tier: true },
  });
});
