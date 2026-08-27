import { Card } from "@/components/ui/card";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { Skeleton } from "@/components/ui/skeleton";

/** Order history skeleton — header, then a stack of receipt rows. */
export default function OrdersLoading() {
  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={6}>
          <Stack gap={2}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-72" />
          </Stack>

          <Stack gap={3}>
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index} className="flex items-center gap-4 p-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 shrink-0" />
              </Card>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Section>
  );
}
