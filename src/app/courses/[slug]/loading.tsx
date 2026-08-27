import { Card } from "@/components/ui/card";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Course detail skeleton.
 *
 * The purchase card is drawn at its real width on the right, because it is the
 * element a visitor is looking for and the one whose late arrival would shift
 * everything else on the page.
 */
export default function CourseDetailLoading() {
  return (
    <Section spacing="md">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <Stack gap={6}>
            <Stack gap={3}>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-10 w-4/5" />
              <Skeleton className="h-5 w-2/3" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </Stack>

            <Card className="flex flex-col gap-3 p-5">
              <Skeleton className="h-5 w-48" />
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))}
            </Card>

            <Stack gap={2}>
              <Skeleton className="h-5 w-40" />
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-lg" />
              ))}
            </Stack>
          </Stack>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card variant="elevated" className="flex flex-col gap-4 p-5">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Stack gap={2}>
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-3 w-full" />
                ))}
              </Stack>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
