import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * Course moderation queries.
 *
 * Unlike the catalogue queries, these deliberately do **not** filter to
 * PUBLISHED. Moderation is precisely the job of looking at what the public
 * cannot see — drafts, submissions awaiting review, rejected courses and
 * soft-deleted ones — so the status filter is a control here rather than a
 * hard-coded floor.
 */

export const COURSE_PAGE_SIZE = 20;

export type CourseStatusFilter = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

export interface AdminCourseRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  status: CourseStatusFilter;
  level: string;
  language: string;
  categoryName: string;
  categorySlug: string;
  instructorName: string;
  instructorId: string | null;
  priceAmount: number;
  currency: string;
  lessonCount: number;
  durationMinutes: number;
  enrollmentCount: number;
  ratingAvg: number;
  ratingCount: number;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
  rejectionReason: string | null;
  /** Metadata gaps that should block publication — computed, not stored. */
  readiness: string[];
}

export interface AdminCourseQuery {
  q?: string;
  status?: CourseStatusFilter;
  categoryId?: string;
  page?: number;
}

export interface AdminCoursePage {
  rows: AdminCourseRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: Record<CourseStatusFilter | "all", number>;
}

/**
 * The metadata review, in one place.
 *
 * These are the things that make a course page look broken or mislead a buyer,
 * so they are surfaced next to the publish button rather than discovered by a
 * learner. They are advisory: an admin can still publish over them, because a
 * hard block would make the console useless the first time a rule is wrong.
 */
function reviewMetadata(course: {
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  learningObjectives: string[];
  lessonCount: number;
  durationMinutes: number;
  priceAmount: number;
  instructorCount: number;
}): string[] {
  const gaps: string[] = [];

  if (!course.thumbnailUrl) gaps.push("No thumbnail");
  if (course.subtitle.trim().length < 10) gaps.push("Subtitle too short");
  if (course.description.trim().length < 120) gaps.push("Description too short");
  if (course.learningObjectives.length < 3) gaps.push("Fewer than 3 learning objectives");
  if (course.lessonCount === 0) gaps.push("No lessons");
  if (course.durationMinutes === 0) gaps.push("No runtime");
  if (course.instructorCount === 0) gaps.push("No instructor assigned");
  // A price of zero is a legitimate choice, but a negative one is data
  // corruption that would break every total downstream.
  if (course.priceAmount < 0) gaps.push("Negative price");

  return gaps;
}

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  description: true,
  status: true,
  level: true,
  language: true,
  priceAmount: true,
  currency: true,
  lessonCount: true,
  durationMinutes: true,
  enrollmentCount: true,
  ratingAvg: true,
  ratingCount: true,
  thumbnailUrl: true,
  learningObjectives: true,
  publishedAt: true,
  updatedAt: true,
  deletedAt: true,
  rejectionReason: true,
  category: { select: { name: true, slug: true } },
  instructors: {
    where: { role: "OWNER" as const },
    take: 1,
    select: { userId: true, user: { select: { name: true } } },
  },
  _count: { select: { instructors: true } },
} satisfies Prisma.CourseSelect;

type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

function toRow(row: CourseRow): AdminCourseRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    level: row.level,
    language: row.language,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    instructorName: row.instructors[0]?.user.name ?? "Unassigned",
    instructorId: row.instructors[0]?.userId ?? null,
    priceAmount: row.priceAmount,
    currency: row.currency,
    lessonCount: row.lessonCount,
    durationMinutes: row.durationMinutes,
    enrollmentCount: row.enrollmentCount,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    thumbnailUrl: row.thumbnailUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    readiness: reviewMetadata({
      subtitle: row.subtitle,
      description: row.description,
      thumbnailUrl: row.thumbnailUrl,
      learningObjectives: row.learningObjectives,
      lessonCount: row.lessonCount,
      durationMinutes: row.durationMinutes,
      priceAmount: row.priceAmount,
      instructorCount: row._count.instructors,
    }),
  };
}

export async function listCourses(query: AdminCourseQuery): Promise<AdminCoursePage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));

  const where: Prisma.CourseWhereInput = {};
  const term = query.q?.trim();
  if (term) {
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { subtitle: { contains: term, mode: "insensitive" } },
    ];
  }
  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;

  const statuses: CourseStatusFilter[] = [
    "DRAFT",
    "IN_REVIEW",
    "PUBLISHED",
    "REJECTED",
    "ARCHIVED",
  ];

  const [total, rows, all, ...byStatus] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      // Submissions awaiting review first, then most recently touched. An
      // admin opening this page should land on the work, not on the archive.
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * COURSE_PAGE_SIZE,
      take: COURSE_PAGE_SIZE,
      select: courseSelect,
    }),
    db.course.count(),
    ...statuses.map((status) => db.course.count({ where: { status } })),
  ]);

  const counts = { all } as AdminCoursePage["counts"];
  statuses.forEach((status, index) => {
    counts[status] = byStatus[index] ?? 0;
  });

  return {
    rows: rows.map(toRow),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / COURSE_PAGE_SIZE)),
    counts,
  };
}

/** The filter options for the category dropdown on the moderation page. */
export async function listCategoryOptions(): Promise<Array<{ id: string; name: string }>> {
  return db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } });
}
