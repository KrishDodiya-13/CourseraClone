import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder block shown while content loads.
 *
 * Marked `aria-hidden` because the surrounding region should own the
 * announcement (see `LoadingState`) - a screen reader reading out a dozen
 * empty boxes is worse than silence.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Several lines of text-shaped skeleton, last line short like real prose. */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText };
