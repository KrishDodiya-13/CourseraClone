import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * One number, named.
 *
 * The delta is only rendered when there is a prior period to compare against —
 * a "+100%" on a platform's first week is noise dressed as a signal. When both
 * periods are zero the tile shows the figure alone.
 */
function StatTile({
  label,
  value,
  hint,
  current,
  previous,
  invertTrend = false,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Optional period comparison, in the same unit. */
  current?: number;
  previous?: number;
  /** For metrics where up is bad, such as failed payments. */
  invertTrend?: boolean;
  className?: string;
}) {
  const comparable =
    current !== undefined && previous !== undefined && (current > 0 || previous > 0);

  const change =
    comparable && previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  const rising = comparable ? current >= previous : false;
  const good = invertTrend ? !rising : rising;

  return (
    <Card className={cn("flex flex-col gap-1.5 p-5", className)}>
      <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      <span className="font-display text-2xl font-semibold" data-numeric>
        {value}
      </span>

      {comparable ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            good ? "text-success" : "text-muted-foreground",
          )}
        >
          {rising ? (
            <TrendingUp className="size-3.5" aria-hidden="true" />
          ) : (
            <TrendingDown className="size-3.5" aria-hidden="true" />
          )}
          {change === null ? "new" : `${change > 0 ? "+" : ""}${change}%`}
          <span className="text-muted-foreground">vs previous 30 days</span>
        </span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </Card>
  );
}

export { StatTile };
