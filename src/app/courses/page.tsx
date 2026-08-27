import type { Metadata } from "next";
import { Suspense } from "react";

import { Container, Section, Stack } from "@/components/layout/primitives";
import { PageHeader } from "@/components/layout/primitives";
import { CatalogSearchInput } from "@/components/catalog/catalog-search-input";
import {
  CatalogFilterSidebar,
  CatalogResults,
  CatalogResultsSkeleton,
  CatalogToolbar,
} from "@/components/catalog/catalog-view";
import { getCatalogFacets } from "@/features/catalog/queries";
import { parseCatalogParams, type RawSearchParams } from "@/features/catalog/search-params";

export const metadata: Metadata = {
  title: "All courses",
  description:
    "Browse the Coursera catalogue. Filter by category, level, price, rating, duration and language.",
};

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parseCatalogParams(raw);
  const facets = await getCatalogFacets();

  // Keys the Suspense boundary so a filter change shows the skeleton rather
  // than holding the previous results in place with no feedback.
  const resultsKey = JSON.stringify(params);

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          <PageHeader
            eyebrow="Catalogue"
            title="All courses"
            description="Everything published on Coursera, filtered however you like."
          />

          <CatalogSearchInput />

          <div className="flex gap-8">
            <CatalogFilterSidebar facets={facets} />

            <div className="min-w-0 flex-1">
              <Stack gap={6}>
                <CatalogToolbar params={params} facets={facets} />
                <Suspense key={resultsKey} fallback={<CatalogResultsSkeleton />}>
                  <CatalogResults params={params} />
                </Suspense>
              </Stack>
            </div>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
