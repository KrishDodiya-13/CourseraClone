import { Container, Section, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogResultsSkeleton } from "@/components/catalog/catalog-view";

export default function CoursesLoading() {
  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          <Stack gap={2}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80" />
          </Stack>
          <Skeleton className="h-11 w-full rounded-full" />
          <div className="flex gap-8">
            <div className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <CatalogResultsSkeleton />
            </div>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
