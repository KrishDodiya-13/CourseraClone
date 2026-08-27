import { Card } from "@/components/ui/card";
import { Grid, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Console skeleton, shared by every admin route.
 *
 * One file at the segment root rather than six near-identical ones: the pages
 * beneath all open with a header, a row of figures and a table or list, so a
 * single shape holds for all of them. The admin queries are the heaviest in the
 * product — the reports page alone runs two dozen aggregates — which is exactly
 * why they should not render against a blank screen.
 */
export default function AdminLoading() {
  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </Stack>

      <Grid cols={4} gap={4}>
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="flex flex-col gap-2 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </Grid>

      <Card className="flex flex-col gap-3 p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </Card>
    </Stack>
  );
}
