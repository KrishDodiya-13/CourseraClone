import { Card } from "@/components/ui/card";
import { Container, Grid, Section, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          <Card className="flex flex-col gap-5 p-6 sm:flex-row">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-3 w-40" />
            </div>
          </Card>

          <Grid cols={4} gap={4}>
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index} className="flex flex-col gap-2 p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-14" />
              </Card>
            ))}
          </Grid>

          <Skeleton className="h-32 w-full rounded-xl" />
        </Stack>
      </Container>
    </Section>
  );
}
