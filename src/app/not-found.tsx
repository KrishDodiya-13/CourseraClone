import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";

export default function NotFound() {
  return (
    <Section spacing="lg">
      <Container size="sm">
        <EmptyState
          icon={<Compass aria-hidden="true" />}
          title="No page at this address"
          description="The link may be out of date, or the page may not exist yet."
          size="lg"
          actions={
            <Button asChild>
              <Link href="/">Back to overview</Link>
            </Button>
          }
        />
      </Container>
    </Section>
  );
}
