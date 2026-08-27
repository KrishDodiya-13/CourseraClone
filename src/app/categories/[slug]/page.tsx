import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { CategoryBanner } from "@/components/catalog/category-banner";
import { CatalogSearchInput } from "@/components/catalog/catalog-search-input";
import {
  CatalogFilterSidebar,
  CatalogResults,
  CatalogResultsSkeleton,
  CatalogToolbar,
} from "@/components/catalog/catalog-view";
import { getCategories, getCatalogFacets, getCategoryBySlug } from "@/features/catalog/queries";
import { parseCatalogParams, type RawSearchParams } from "@/features/catalog/search-params";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

/**
 * Categories are a small, curated set that changes rarely, so every valid slug
 * is known at build time. Refusing unknown ones here means Next serves a real
 * 404 rather than generating a page on demand and caching the not-found
 * result behind a 200.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  // See the note on the course page: notFound() from generateMetadata loses
  // the 404 status. The page body owns that decision.
  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description: category.description,
  };
}

/**
 * A category landing page is the catalogue with one facet pinned.
 *
 * The category comes from the path, not the query string, so it is not
 * removable from within the page — hence `hideCategory`, which drops the
 * redundant control and keeps it out of the clearable chips.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);

  if (!category) notFound();

  const parsed = parseCatalogParams(raw);
  const catalogParams = { ...parsed, category: category.slug };
  const facets = await getCatalogFacets();
  const resultsKey = JSON.stringify(catalogParams);

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          <CategoryBanner
            name={category.name}
            description={category.description}
            slug={category.slug}
            iconKey={category.iconKey}
            courseCount={category.courseCount}
          />

          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href={routes.categories}>All categories</Link>
            </Button>
          </div>

          <CatalogSearchInput placeholder={`Search in ${category.name}`} />

          <div className="flex gap-8">
            <CatalogFilterSidebar facets={facets} hideCategory />
            <div className="min-w-0 flex-1">
              <Stack gap={6}>
                <CatalogToolbar params={catalogParams} facets={facets} hideCategory />
                <Suspense key={resultsKey} fallback={<CatalogResultsSkeleton />}>
                  <CatalogResults
                    params={catalogParams}
                    emptyAction={
                      <Button variant="outline" asChild>
                        <Link href={routes.courses}>Browse all courses</Link>
                      </Button>
                    }
                  />
                </Suspense>
              </Stack>
            </div>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
