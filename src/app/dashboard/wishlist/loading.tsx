import { Card } from "@/components/ui/card";
import { Grid, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard skeleton.
 *
 * Mirrors the real layout — stat row, then cards — so the page does not jump
 * when data arrives.
 */
export default function DashboardLoading() {
  return (
    <Stack gap={8}>
      <Stack gap={2}>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-48" />
      </Stack>

      <Grid cols={4} gap={4}>
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="flex flex-col gap-2 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </Grid>

      <Stack gap={4}>
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index} className="flex flex-col gap-4 p-4 sm:flex-row">
            <Skeleton className="aspect-video w-full shrink-0 sm:w-44" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-full" />
            </div>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
