"use client";

import { useEffect } from "react";

import { Container, Section } from "@/components/layout/primitives";
import { ErrorState } from "@/components/states/error-state";

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section spacing="lg">
      <Container size="sm">
        <ErrorState
          title="We could not load the catalogue"
          description="The search index or the database did not respond. Trying again usually clears it."
          onRetry={reset}
          size="lg"
        />
      </Container>
    </Section>
  );
}
