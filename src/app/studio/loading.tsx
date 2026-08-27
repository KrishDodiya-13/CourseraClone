import { Card } from "@/components/ui/card";
import { Container, Grid, Section, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";

/** Studio skeleton, shared by every instructor route beneath it. */
export default function StudioLoading() {
  return (
    <Section spacing="md">
      <Container>
        <Stack gap={6}>
          <Stack gap={2}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80" />
          </Stack>

          <Grid cols={3} gap={4}>
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="flex flex-col gap-2 p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))}
          </Grid>

          <Stack gap={3}>
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className="flex flex-col gap-3 p-4">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </Card>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Section>
  );
}
