import "server-only";

import { db } from "@/server/db";

/**
 * Category administration queries.
 *
 * Categories are the one piece of catalogue structure an admin edits directly,
 * and the one whose ordering the public sees — `position` drives the navbar and
 * the category grid, so reordering here is a visible change rather than an
 * internal preference.
 */

export interface AdminCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  position: number;
  parentId: string | null;
  parentName: string | null;
  /** Live count of published courses — the denormalised column is not trusted. */
  publishedCourseCount: number;
  /** Everything in the category, published or not. Deletion depends on this. */
  totalCourseCount: number;
  childCount: number;
}

export async function listCategories(): Promise<AdminCategoryRow[]> {
  const rows = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      iconKey: true,
      position: true,
      parentId: true,
      parent: { select: { name: true } },
      _count: {
        select: {
          courses: true,
          children: true,
        },
      },
    },
  });

  // The published count needs a different filter from the total, and Prisma
  // allows only one filter per `_count` relation, so it is fetched separately
  // and joined in memory. There are tens of categories, not thousands.
  const published = await db.course.groupBy({
    by: ["categoryId"],
    where: { status: "PUBLISHED", deletedAt: null },
    _count: { _all: true },
  });

  const publishedByCategory = new Map(
    published.map((entry) => [entry.categoryId, entry._count._all]),
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    iconKey: row.iconKey,
    position: row.position,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    publishedCourseCount: publishedByCategory.get(row.id) ?? 0,
    totalCourseCount: row._count.courses,
    childCount: row._count.children,
  }));
}
