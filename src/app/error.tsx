"use client";

import { useEffect } from "react";

import { Container, Section } from "@/components/layout/primitives";
import { ErrorState } from "@/components/states/error-state";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 15 replaces this with real error reporting.
    console.error(error);
  }, [error]);

  return (
    <Section spacing="lg">
      <Container size="sm">
        <ErrorState
          title="This page did not load"
          description="Something failed on our side. Trying again usually clears it."
          onRetry={reset}
          size="lg"
        />
      </Container>
    </Section>
  );
}
