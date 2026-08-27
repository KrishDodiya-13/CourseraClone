import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { DEFAULT_CURRENCY } from "@/lib/currency";

/**
 * User administration queries.
 *
 * Read-only. Every function here is called from a page that has already passed
 * `requireAdmin`, but none of them assume it — they return data and grant
 * nothing, so a mistake in a caller leaks a list rather than a capability.
 *
 * Note what is *not* selected anywhere below: `passwordHash`. An admin has no
 * business seeing it, and a column that is never selected cannot be leaked by
 * a careless spread further up the stack.
 */

export const USER_PAGE_SIZE = 20;

export type UserRoleFilter = "STUDENT" | "INSTRUCTOR" | "ADMIN";
export type UserStatusFilter = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRoleFilter;
  status: UserStatusFilter;
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
  enrollmentCount: number;
  taughtCourseCount: number;
}

export interface AdminUserQuery {
  q?: string;
  role?: UserRoleFilter;
  status?: UserStatusFilter;
  page?: number;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: { all: number; students: number; instructors: number; admins: number; suspended: number };
}

function buildWhere(query: AdminUserQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  const term = query.q?.trim();
  if (term) {
    // Name and email only. Searching by id would be a nice convenience but it
    // is also the shape of an enumeration attack, and an admin who has an id
    // already has a link to follow.
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;

  return where;
}

export async function listUsers(query: AdminUserQuery): Promise<AdminUserPage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const where = buildWhere(query);

  const [total, rows, students, instructors, admins, suspended, all] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USER_PAGE_SIZE,
      take: USER_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        deletedAt: true,
        profile: { select: { avatarUrl: true } },
        _count: { select: { enrollments: true, taughtCourses: true } },
      },
    }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "INSTRUCTOR" } }),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.user.count(),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      emailVerified: row.emailVerified !== null,
      avatarUrl: row.profile?.avatarUrl ?? null,
      createdAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      enrollmentCount: row._count.enrollments,
      taughtCourseCount: row._count.taughtCourses,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USER_PAGE_SIZE)),
    counts: { all, students, instructors, admins, suspended },
  };
}

export interface AdminUserDetail extends AdminUserRow {
  timezone: string;
  locale: string;
  headline: string | null;
  completedCount: number;
  certificateCount: number;
  orderCount: number;
  paidTotal: number;
  currency: string;
  lastActivityAt: string | null;
  recentEnrollments: Array<{
    courseTitle: string;
    courseSlug: string;
    status: string;
    percent: number;
    enrolledAt: string;
  }>;
}

/** One user, with enough context to judge a moderation decision. */
export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      timezone: true,
      locale: true,
      createdAt: true,
      deletedAt: true,
      profile: { select: { avatarUrl: true } },
      instructorProfile: { select: { headline: true } },
      _count: { select: { enrollments: true, taughtCourses: true, certificates: true } },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        take: 8,
        select: {
          status: true,
          enrolledAt: true,
          course: { select: { title: true, slug: true } },
          progress: { select: { percent: true } },
        },
      },
    },
  });

  if (!row) return null;

  const [completedCount, paid, activity] = await Promise.all([
    db.enrollment.count({ where: { userId, status: "COMPLETED" } }),
    db.order.aggregate({
      where: { userId, status: "PAID" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.learningActivity.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    emailVerified: row.emailVerified !== null,
    avatarUrl: row.profile?.avatarUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    enrollmentCount: row._count.enrollments,
    taughtCourseCount: row._count.taughtCourses,
    timezone: row.timezone,
    locale: row.locale,
    headline: row.instructorProfile?.headline ?? null,
    completedCount,
    certificateCount: row._count.certificates,
    orderCount: paid._count,
    paidTotal: paid._sum.totalAmount ?? 0,
    currency: DEFAULT_CURRENCY,
    lastActivityAt: activity?.date.toISOString() ?? null,
    recentEnrollments: row.enrollments.map((enrollment) => ({
      courseTitle: enrollment.course.title,
      courseSlug: enrollment.course.slug,
      status: enrollment.status,
      percent: enrollment.progress?.percent ?? 0,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    })),
  };
}

/**
 * How many admins remain who can still sign in.
 *
 * Used to refuse the change that would leave the platform with no way back in.
 */
export async function countActiveAdmins(): Promise<number> {
  return db.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null } });
}
