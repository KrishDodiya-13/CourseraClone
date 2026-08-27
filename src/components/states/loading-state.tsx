import * as React from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export interface LoadingStateProps extends React.ComponentProps<"div"> {
  /** Announced to assistive tech and shown beneath the spinner. */
  label?: string;
  /** Hide the visible text but keep the announcement. */
  labelHidden?: boolean;
  size?: "sm" | "md" | "lg";
  bordered?: boolean;
}

const padding = {
  sm: "py-8",
  md: "py-14",
  lg: "py-24",
} as const;

/**
 * Busy region for content that is being fetched.
 *
 * Prefer a `Skeleton` layout when the shape of the incoming content is known -
 * it avoids the layout shift a spinner causes. Use this when it is not.
 */
function LoadingState({
  label = "Loading",
  labelHidden = false,
  size = "md",
  bordered = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 text-center",
        padding[size],
        bordered && "rounded-xl border border-dashed border-border bg-card/40",
        className,
      )}
      {...props}
    >
      <Spinner size={size === "sm" ? "sm" : "lg"} />
      <span className={cn("text-sm text-muted-foreground", labelHidden && "sr-only")}>{label}</span>
    </div>
  );
}

export { LoadingState };
