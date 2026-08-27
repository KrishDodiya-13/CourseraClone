"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/states/error-state";

export default function DashboardError({
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
    <ErrorState
      title="We could not load your dashboard"
      description="Your progress is safe — this is a problem reading it. Trying again usually clears it."
      onRetry={reset}
      size="lg"
    />
  );
}
