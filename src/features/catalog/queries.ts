import "server-only";

import { cache } from "react";

import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  CategorySummary,
  CourseDetail,
  CourseSummary,
  InstructorSummary,
  TestimonialSummary,
} from "@/features/catalog/types";
import {
  DURATION_OPTIONS,
  PAGE_SIZE,
  effectiveSort,
  type CatalogParams,
} from "@/features/catalog/search-params";

/**
 * Catalogue reads.
 *
 * Search runs in Postgres, not in JavaScript. The two-step shape below is
 * deliberate:
 *
 *   1. one raw SQL statement resolves ids + relevance rank, applying every
 *      filter and the sort, with LIMIT/OFFSET — so the database does the
 *      work and only one page of ids crosses the wire;
 *   2. Prisma hydrates those ids with their relations, giving typed results
 *      without hand-writing the joins.
 *
 * Doing it in one raw query would mean assembling nested relation rows by
 * hand; doing it entirely in Prisma would mean no tsvector ranking at all.
 */

/* -------------------------------------------------------------------------- */
/*  Shared selections                                                         */
/* -------------------------------------------------------------------------- */

const courseCardSelect = {
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
} satisfies Prisma.CourseSelect;

type CourseCardRow = Prisma.CourseGetPayload<{ select: typeof courseCardSelect }>;

function toCourseSummary(row: CourseCardRow): CourseSummary {
  const owner = row.instructors[0]?.user;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    thumbnailUrl: row.thumbnailUrl,
    level: row.level,
    language: row.language,
    category: row.category,
    tags: row.tags.map((tag) => tag.name),
    tagSlugs: row.tags.map((tag) => tag.slug),
    instructor: {
      id: owner?.id ?? "",
      slug: owner?.instructorProfile?.slug ?? "",
      name: owner?.name ?? "Coursera",
      avatarUrl: owner?.profile?.avatarUrl ?? null,
    },
    priceAmount: row.priceAmount,
    compareAtAmount: row.compareAtAmount,
    currency: row.currency,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    enrollmentCount: row.enrollmentCount,
    lessonCount: row.lessonCount,
    durationMinutes: row.durationMinutes,
    isBestseller: row.isBestseller,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Filter construction                                                       */
/* -------------------------------------------------------------------------- */

/** Every catalogue read is scoped to published, non-deleted courses. */
function baseConditions(): Prisma.Sql[] {
  return [Prisma.sql`c."status" = 'PUBLISHED'`, Prisma.sql`c."deletedAt" IS NULL`];
}

function priceCondition(price: CatalogParams["price"]): Prisma.Sql | null {
  switch (price) {
    case "free":
      return Prisma.sql`c."priceAmount" = 0`;
    // Amounts are paise, so a rupee threshold is multiplied by 100.
    case "under-999":
      return Prisma.sql`c."priceAmount" > 0 AND c."priceAmount" < 99900`;
    case "999-2499":
      return Prisma.sql`c."priceAmount" BETWEEN 99900 AND 249900`;
    case "2500-4999":
      return Prisma.sql`c."priceAmount" BETWEEN 250000 AND 499900`;
    case "over-5000":
      return Prisma.sql`c."priceAmount" > 499900`;
    default:
      return null;
  }
}

/** Duration buckets are OR-ed together, since they are alternatives. */
function durationCondition(durations: CatalogParams["duration"]): Prisma.Sql | null {
  if (durations.length === 0) return null;

  const ranges = durations
    .map((value) => DURATION_OPTIONS.find((option) => option.value === value))
    .filter((option): option is (typeof DURATION_OPTIONS)[number] => Boolean(option))
    .map((option) =>
      option.maxMinutes === null
        ? Prisma.sql`c."durationMinutes" >= ${option.minMinutes}`
        : Prisma.sql`(c."durationMinutes" >= ${option.minMinutes} AND c."durationMinutes" < ${option.maxMinutes})`,
    );

  if (ranges.length === 0) return null;
  return Prisma.sql`(${Prisma.join(ranges, " OR ")})`;
}

function buildConditions(params: CatalogParams): Prisma.Sql[] {
  const conditions = baseConditions();

  if (params.category) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "categories" cat WHERE cat."id" = c."categoryId" AND cat."slug" = ${params.category})`,
    );
  }

  if (params.tag.length > 0) {
    // Every selected tag must be present — narrowing, not widening. Selecting
    // two tags should give fewer results, which is what a filter implies.
    conditions.push(
      Prisma.sql`(
        SELECT COUNT(DISTINCT t."slug")
        FROM "_CourseTags" ct
        JOIN "tags" t ON t."id" = ct."B"
        WHERE ct."A" = c."id" AND t."slug" IN (${Prisma.join(params.tag)})
      ) = ${params.tag.length}`,
    );
  }

  if (params.level.length > 0) {
    conditions.push(
      Prisma.sql`c."level" IN (${Prisma.join(
        params.level.map((level) => Prisma.sql`${level}::"CourseLevel"`),
      )})`,
    );
  }

  if (params.language.length > 0) {
    conditions.push(Prisma.sql`c."language" IN (${Prisma.join(params.language)})`);
  }

  if (params.rating > 0) {
    conditions.push(Prisma.sql`c."ratingAvg" >= ${params.rating}`);
  }

  const price = priceCondition(params.price);
  if (price) conditions.push(price);

  const duration = durationCondition(params.duration);
  if (duration) conditions.push(duration);

  if (params.q) {
    // Course text is matched by stemmed full-text search; instructor names and
    // tag labels are matched by trigram-backed ILIKE, because proper nouns do
    // not stem usefully ("Tanaka" has no linguistic root to reduce to).
    conditions.push(
      Prisma.sql`(
        c."searchVector" @@ websearch_to_tsquery('english', ${params.q})
        OR EXISTS (
          SELECT 1 FROM "course_instructors" ci
          JOIN "users" u ON u."id" = ci."userId"
          WHERE ci."courseId" = c."id" AND u."name" ILIKE ${"%" + params.q + "%"}
        )
        OR EXISTS (
          SELECT 1 FROM "_CourseTags" ct
          JOIN "tags" t ON t."id" = ct."B"
          WHERE ct."A" = c."id" AND t."name" ILIKE ${"%" + params.q + "%"}
        )
      )`,
    );
  }

  return conditions;
}

function orderByClause(params: CatalogParams): Prisma.Sql {
  const sort = effectiveSort(params);

  switch (sort) {
    case "popular":
      return Prisma.sql`c."enrollmentCount" DESC, c."ratingAvg" DESC`;
    case "rating":
      // Rating count breaks the tie so a single 5-star review does not
      // outrank a course with two thousand of them.
      return Prisma.sql`c."ratingAvg" DESC, c."ratingCount" DESC`;
    case "newest":
      return Prisma.sql`COALESCE(c."publishedAt", c."createdAt") DESC`;
    case "price-asc":
      return Prisma.sql`c."priceAmount" ASC, c."enrollmentCount" DESC`;
    case "price-desc":
      return Prisma.sql`c."priceAmount" DESC, c."enrollmentCount" DESC`;
    default:
      return Prisma.sql`rank DESC, c."enrollmentCount" DESC`;
  }
}

/* -------------------------------------------------------------------------- */
/*  Catalogue listing                                                         */
/* -------------------------------------------------------------------------- */

export interface CatalogResult {
  courses: CourseSummary[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export async function searchCourses(params: CatalogParams): Promise<CatalogResult> {
  const conditions = buildConditions(params);
  const where = Prisma.join(conditions, " AND ");
  const offset = (params.page - 1) * PAGE_SIZE;

  const rankExpression = params.q
    ? Prisma.sql`ts_rank(c."searchVector", websearch_to_tsquery('english', ${params.q}))`
    : Prisma.sql`0`;

  const [rows, countRows] = await Promise.all([
    db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT c."id", ${rankExpression} AS rank
      FROM "courses" c
      WHERE ${where}
      ORDER BY ${orderByClause(params)}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
    db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "courses" c WHERE ${where}
    `),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const ids = rows.map((row) => row.id);

  if (ids.length === 0) {
    return { courses: [], total, page: params.page, pageCount: 0, pageSize: PAGE_SIZE };
  }

  const hydrated = await db.course.findMany({
    where: { id: { in: ids } },
    select: courseCardSelect,
  });

  // `IN` does not preserve order, so the ranked sequence is restored here.
  const byId = new Map(hydrated.map((row) => [row.id, row]));
  const courses = ids
    .map((id) => byId.get(id))
    .filter((row): row is CourseCardRow => Boolean(row))
    .map(toCourseSummary);

  return {
    courses,
    total,
    page: params.page,
    pageCount: Math.ceil(total / PAGE_SIZE),
    pageSize: PAGE_SIZE,
  };
}

/* -------------------------------------------------------------------------- */
/*  Facets                                                                    */
/* -------------------------------------------------------------------------- */

export interface CatalogFacets {
  categories: Array<{ slug: string; name: string; count: number }>;
  tags: Array<{ slug: string; name: string; count: number }>;
  languages: Array<{ code: string; count: number }>;
}

/**
 * Facet counts for the filter sidebar, computed against the published
 * catalogue rather than the current result set — so a filter never appears
 * with a count of zero purely because another filter is active.
 */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  const [categories, tags, languages] = await Promise.all([
    db.category.findMany({
      where: { courses: { some: { status: "PUBLISHED", deletedAt: null } } },
      select: {
        slug: true,
        name: true,
        _count: { select: { courses: { where: { status: "PUBLISHED", deletedAt: null } } } },
      },
      orderBy: { position: "asc" },
    }),
    db.tag.findMany({
      where: { courses: { some: { status: "PUBLISHED", deletedAt: null } } },
      select: {
        slug: true,
        name: true,
        _count: { select: { courses: { where: { status: "PUBLISHED", deletedAt: null } } } },
      },
    }),
    db.course.groupBy({
      by: ["language"],
      where: { status: "PUBLISHED", deletedAt: null },
      _count: { language: true },
    }),
  ]);

  return {
    categories: categories.map((row) => ({
      slug: row.slug,
      name: row.name,
      count: row._count.courses,
    })),
    tags: tags
      .map((row) => ({ slug: row.slug, name: row.name, count: row._count.courses }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    languages: languages
      .map((row) => ({ code: row.language, count: row._count.language }))
      .sort((a, b) => b.count - a.count),
  };
}

/* -------------------------------------------------------------------------- */
/*  Categories                                                                */
/* -------------------------------------------------------------------------- */

export async function getCategories(): Promise<CategorySummary[]> {
  const rows = await db.category.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      iconKey: true,
      _count: { select: { courses: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    iconKey: row.iconKey as CategorySummary["iconKey"],
    courseCount: row._count.courses,
  }));
}

export const getCategoryBySlug = cache(async (slug: string): Promise<CategorySummary | null> => {
  const row = await db.category.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      iconKey: true,
      _count: { select: { courses: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    iconKey: row.iconKey as CategorySummary["iconKey"],
    courseCount: row._count.courses,
  };
});

/* -------------------------------------------------------------------------- */
/*  Course detail                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Memoised per request, because both `generateMetadata` and the page body need
 * it and neither should pay for the other's query.
 */
export const getCourseBySlug = cache(async (slug: string): Promise<CourseDetail | null> => {
  const row = await db.course.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null },
    select: {
      ...courseCardSelect,
      description: true,
      learningObjectives: true,
      prerequisites: true,
      publishedAt: true,
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          lessons: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              summary: true,
              type: true,
              durationSeconds: true,
              // The flag is exposed; the playback id deliberately is not.
              // Media access is granted per request in Phase 8/9 after an
              // enrolment check, never by shipping an id to the browser.
              isFreePreview: true,
            },
          },
        },
      },
      instructors: {
        orderBy: { role: "asc" },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              name: true,
              profile: { select: { avatarUrl: true, bio: true } },
              instructorProfile: {
                select: {
                  slug: true,
                  headline: true,
                  expertise: true,
                  ratingAvg: true,
                  ratingCount: true,
                  studentCount: true,
                  courseCount: true,
                },
              },
            },
          },
        },
      },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          user: { select: { name: true, profile: { select: { avatarUrl: true } } } },
        },
      },
    },
  });

  if (!row) return null;

  const owner = row.instructors[0]?.user;

  return {
    ...toCourseSummary(row as CourseCardRow),
    description: row.description,
    learningObjectives: row.learningObjectives,
    prerequisites: row.prerequisites,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    sections: row.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        type: lesson.type,
        durationSeconds: lesson.durationSeconds,
        isFreePreview: lesson.isFreePreview,
      })),
    })),
    instructorProfile: owner
      ? {
          id: owner.id,
          slug: owner.instructorProfile?.slug ?? "",
          name: owner.name,
          headline: owner.instructorProfile?.headline ?? "",
          bio: owner.profile?.bio ?? null,
          avatarUrl: owner.profile?.avatarUrl ?? null,
          expertise: owner.instructorProfile?.expertise ?? [],
          ratingAvg: owner.instructorProfile?.ratingAvg ?? 0,
          ratingCount: owner.instructorProfile?.ratingCount ?? 0,
          studentCount: owner.instructorProfile?.studentCount ?? 0,
          courseCount: owner.instructorProfile?.courseCount ?? 0,
        }
      : null,
    reviews: row.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.createdAt.toISOString(),
      authorName: review.user.name,
      authorAvatarUrl: review.user.profile?.avatarUrl ?? null,
    })),
  };
});

/** Slugs for the sitemap. */
export async function getPublishedCourseSlugs(): Promise<string[]> {
  const rows = await db.course.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

/* -------------------------------------------------------------------------- */
/*  Home page                                                                 */
/* -------------------------------------------------------------------------- */

export async function getFeaturedCourses(limit = 6): Promise<CourseSummary[]> {
  const rows = await db.course.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    orderBy: [{ isBestseller: "desc" }, { enrollmentCount: "desc" }],
    take: limit,
    select: courseCardSelect,
  });
  return rows.map(toCourseSummary);
}

/**
 * Highest rated, with a review-count floor.
 *
 * Without the floor this list is whatever course happens to have a single
 * five-star review, which is the opposite of a recommendation. Twenty is low
 * enough to keep the list full and high enough that the average means something.
 */
export async function getTopRatedCourses(limit = 8): Promise<CourseSummary[]> {
  const rows = await db.course.findMany({
    where: { status: "PUBLISHED", deletedAt: null, ratingCount: { gte: 20 } },
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
    take: limit,
    select: courseCardSelect,
  });
  return rows.map(toCourseSummary);
}

/** Most recently published. Falls back to creation date for anything unpublished. */
export async function getRecentCourses(limit = 8): Promise<CourseSummary[]> {
  const rows = await db.course.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: courseCardSelect,
  });
  return rows.map(toCourseSummary);
}

/**
 * Trending — enrolment weighted towards recency.
 *
 * A pure enrolment sort is a popularity ranking that never changes, which is
 * not what "trending" means to anyone. Ordering by enrolments *within* the
 * recently published set gives a list that actually moves as the catalogue
 * grows, without needing an events table this project does not have.
 */
export async function getTrendingCourses(limit = 8): Promise<CourseSummary[]> {
  const rows = await db.course.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    orderBy: [{ enrollmentCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
    skip: limit, // steps past the bestsellers already shown in Featured
    select: courseCardSelect,
  });
  return rows.map(toCourseSummary);
}

export async function getPopularInstructors(limit = 4): Promise<InstructorSummary[]> {
  const rows = await db.instructorProfile.findMany({
    where: { approvedAt: { not: null } },
    orderBy: [{ studentCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      headline: true,
      expertise: true,
      ratingAvg: true,
      studentCount: true,
      courseCount: true,
      user: { select: { name: true, profile: { select: { avatarUrl: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.user.name,
    headline: row.headline,
    avatarUrl: row.user.profile?.avatarUrl ?? null,
    ratingAvg: row.ratingAvg,
    studentCount: row.studentCount,
    courseCount: row.courseCount,
    expertise: row.expertise,
  }));
}

export async function getRelatedCourses(
  courseId: string,
  categorySlug: string,
  limit = 3,
): Promise<CourseSummary[]> {
  const rows = await db.course.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      id: { not: courseId },
      category: { slug: categorySlug },
    },
    orderBy: [{ enrollmentCount: "desc" }],
    take: limit,
    select: courseCardSelect,
  });
  return rows.map(toCourseSummary);
}

/**
 * Testimonials for the home page, drawn from real published reviews.
 *
 * Only 4- and 5-star reviews are surfaced here — this is a marketing slot, and
 * that is an editorial choice rather than a claim that no lower ratings exist.
 * The full, unfiltered distribution is on every course detail page.
 */
export async function getRecentTestimonials(limit = 4): Promise<TestimonialSummary[]> {
  const rows = await db.review.findMany({
    where: {
      status: "PUBLISHED",
      rating: { gte: 4 },
      course: { status: "PUBLISHED", deletedAt: null },
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      rating: true,
      body: true,
      course: { select: { title: true } },
      user: {
        select: {
          name: true,
          profile: { select: { avatarUrl: true, headline: true, location: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    quote: row.body,
    rating: row.rating,
    author: {
      name: row.user.name,
      role: row.user.profile?.headline ?? row.user.profile?.location ?? "Coursera learner",
      avatarUrl: row.user.profile?.avatarUrl ?? null,
    },
    courseTitle: row.course.title,
  }));
}
