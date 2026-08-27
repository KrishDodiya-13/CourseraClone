import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const spinnerSizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
} as const;

/** Bare spinning indicator. For a full loading region use `LoadingState`. */
function Spinner({
  size = "md",
  className,
}: {
  size?: keyof typeof spinnerSizes;
  className?: string;
}) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("animate-spin text-muted-foreground", spinnerSizes[size], className)}
    />
  );
}

export { Spinner };
