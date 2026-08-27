"use client";

import { useEffect } from "react";

import { Container, Section } from "@/components/layout/primitives";
import { ErrorState } from "@/components/states/error-state";

export default function ProfileError({
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
          title="We could not load your profile"
          description="Nothing has been lost — this is a problem reading your account. Try again."
          onRetry={reset}
          size="lg"
        />
      </Container>
    </Section>
  );
}
