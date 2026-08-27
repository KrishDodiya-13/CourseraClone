import Link from "next/link";
import { SearchX } from "lucide-react";

import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Grid, Inline, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states/empty-state";
import { CourseCard } from "@/components/catalog/course-card";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import {
  ActiveFilterChips,
  CatalogFilterSheet,
  CatalogFilterSidebar,
  CatalogSort,
} from "@/components/catalog/catalog-filters";
import { searchCourses, type CatalogFacets } from "@/features/catalog/queries";
import { getWishlistedCourseIds } from "@/features/enrollment/queries";
import { hasActiveFilters, type CatalogParams } from "@/features/catalog/search-params";

/**
 * The catalogue results region.
 *
 * A server component that runs the query, wrapped in Suspense by its callers
 * so the surrounding chrome — search box, filters, sort — stays interactive
 * while a new result set is fetched. That is what makes filtering feel like it
 * updates in place rather than reloading the page.
 */
async function CatalogResults({
  params,
  emptyAction,
}: {
  params: CatalogParams;
  emptyAction?: React.ReactNode;
}) {
  // One query for the whole page rather than one per card.
  const [{ courses, total, page, pageCount, pageSize }, wishlisted] = await Promise.all([
    searchCourses(params),
    getWishlistedCourseIds(),
  ]);

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<SearchX aria-hidden="true" />}
        title={params.q ? `No courses match “${params.q}”` : "No courses match these filters"}
        description="Try removing a filter, or search for a broader topic."
        size="lg"
        actions={
          emptyAction ?? (
            <Button variant="outline" asChild>
              <Link href={routes.courses}>Clear filters</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <Stack gap={8}>
      <Grid cols={3} gap={5}>
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} isWishlisted={wishlisted.has(course.id)} />
        ))}
      </Grid>
      <CatalogPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} />
    </Stack>
  );
}

/** Matches the real grid so swapping to results does not shift the layout. */
function CatalogResultsSkeleton() {
  return (
    <Grid cols={3} gap={5} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="flex flex-col overflow-hidden">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Inline gap={2} wrap={false}>
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-28" />
            </Inline>
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </Card>
      ))}
    </Grid>
  );
}

/** Result count line, read by screen readers as results change. */
async function CatalogResultCount({ params }: { params: CatalogParams }) {
  const { total } = await searchCourses(params);
  return (
    <p className="text-sm text-muted-foreground" role="status" aria-live="polite" data-numeric>
      <span className="font-semibold text-foreground">{total.toLocaleString("en-US")}</span>{" "}
      {total === 1 ? "course" : "courses"}
      {params.q ? <> for “{params.q}”</> : null}
    </p>
  );
}

/** The filter toolbar: chips, count, sort, and the mobile filter trigger. */
function CatalogToolbar({
  params,
  facets,
  hideCategory,
}: {
  params: CatalogParams;
  facets: CatalogFacets;
  hideCategory?: boolean;
}) {
  const activeCount =
    params.tag.length +
    params.level.length +
    params.language.length +
    params.duration.length +
    (params.category && !hideCategory ? 1 : 0) +
    (params.price !== "all" ? 1 : 0) +
    (params.rating > 0 ? 1 : 0);

  return (
    <Stack gap={4}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Inline gap={3}>
          <CatalogFilterSheet
            facets={facets}
            hideCategory={hideCategory}
            activeCount={activeCount}
          />
          <CatalogResultCount params={params} />
        </Inline>
        <CatalogSort hasQuery={Boolean(params.q)} />
      </div>

      {hasActiveFilters(params) ? <ActiveFilterChips params={params} facets={facets} /> : null}
    </Stack>
  );
}

export { CatalogResults, CatalogResultsSkeleton, CatalogToolbar, CatalogFilterSidebar };
