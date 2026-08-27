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
  title: "Search",
  description: "Search the Coursera catalogue by topic, instructor or tag.",
  // Search result pages have no stable content worth indexing.
  robots: { index: false, follow: true },
};

/**
 * Search-first entry point.
 *
 * Same query, same filters, same components as /courses — the difference is
 * presentation: the search box is focused on arrival and the page leads with
 * the query rather than the catalogue.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parseCatalogParams(raw);
  const facets = await getCatalogFacets();
  const resultsKey = JSON.stringify(params);

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          <PageHeader
            eyebrow="Search"
            title={params.q ? `Results for “${params.q}”` : "Search courses"}
            description={
              params.q
                ? "Matched on course title, description, instructor and tags."
                : "Search across course titles, descriptions, instructors and tags."
            }
          />

          <CatalogSearchInput autoFocus />

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
