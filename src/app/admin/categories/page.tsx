import type { Metadata } from "next";

import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/authz";
import { PageHeader, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { CategoryManager } from "@/app/admin/categories/category-manager";
import { listCategories } from "@/features/admin/categories";

export const metadata: Metadata = { title: "Categories" };

/**
 * Category management.
 *
 * The counts shown next to each category are computed live rather than read
 * from the denormalised `courseCount` column, because this is the page where a
 * discrepancy between the two would actually matter — an admin deleting a
 * category needs to know what is really in it.
 */
export default async function AdminCategoriesPage() {
  await requireAdmin(routes.adminCategories);

  const categories = await listCategories();

  return (
    <Stack gap={6}>
      <PageHeader
        eyebrow="Admin"
        title="Categories"
        description="Create, rename and reorder the taxonomy the catalogue is organised by."
      />

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Courses need a category before they can be published, so this is the place to start."
        />
      ) : (
        <CategoryManager categories={categories} />
      )}
    </Stack>
  );
}
