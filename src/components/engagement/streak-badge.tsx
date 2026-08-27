import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The streak indicator.
 *
 * Reads as "🔥 7 Day Learning Streak". The flame is drawn rather than typed as
 * an emoji so it inherits colour and sizing from the design system and renders
 * identically across platforms — an emoji glyph is a different picture on every
 * OS and cannot take a token colour.
 */
function StreakBadge({
  days,
  size = "md",
  className,
}: {
  days: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const active = days > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-medium",
        active
          ? "bg-accent-subtle text-accent-subtle-foreground"
          : "bg-secondary text-muted-foreground",
        size === "sm" && "px-2.5 py-1 text-sm",
        size === "md" && "px-3 py-1.5 text-sm",
        size === "lg" && "px-4 py-2 text-base",
        className,
      )}
    >
      <Flame
        className={cn(
          "shrink-0",
          size === "lg" ? "size-5" : "size-4",
          active ? "fill-accent/30" : "",
        )}
        aria-hidden="true"
      />
      <span data-numeric>
        {active ? (
          <>
            <strong>{days}</strong> Day Learning Streak
          </>
        ) : (
          "No streak yet"
        )}
      </span>
    </span>
  );
}

export { StreakBadge };
