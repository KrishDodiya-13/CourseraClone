import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/format";

/**
 * Star rating with an accessible text equivalent.
 *
 * The stars are decorative — the rating is announced once, as a sentence,
 * rather than as five separate icons.
 */
function RatingStars({
  rating,
  count,
  size = "sm",
  className,
}: {
  rating: number;
  /** Number of reviews; omitted from the label when absent. */
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(rating * 2) / 2;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("font-semibold text-foreground", size === "sm" ? "text-sm" : "text-base")}
        data-numeric
        aria-hidden="true"
      >
        {formatRating(rating)}
      </span>
      <span className="inline-flex gap-px" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((position) => (
          <Star
            key={position}
            className={cn(
              size === "sm" ? "size-3.5" : "size-4",
              position <= rounded ? "fill-accent text-accent" : "fill-transparent text-border",
            )}
          />
        ))}
      </span>
      {count === undefined ? null : (
        <span className="text-sm text-muted-foreground" data-numeric aria-hidden="true">
          ({count.toLocaleString("en-US")})
        </span>
      )}
      <span className="sr-only">
        Rated {formatRating(rating)} out of 5
        {count === undefined ? "" : ` from ${count.toLocaleString("en-US")} reviews`}
      </span>
    </span>
  );
}

export { RatingStars };
