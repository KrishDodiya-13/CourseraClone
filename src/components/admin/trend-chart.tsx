import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/format";

import type { SignupPoint } from "@/features/admin/analytics";

/**
 * A 30-day trend, drawn as bars.
 *
 * Deliberately not a line: with one point per day and small counts, a line
 * implies values between the days that do not exist. Bars say "three signups on
 * Tuesday" without also implying 1.5 on Tuesday afternoon.
 *
 * The chart is inline SVG with no library, and every bar carries a `<title>`,
 * so the numbers are reachable by pointer and by screen reader. The table
 * beneath the summary carries the same data for anyone who cannot use either.
 */
function TrendChart({
  points,
  series,
  label,
  className,
}: {
  points: SignupPoint[];
  series: "users" | "enrollments";
  label: string;
  className?: string;
}) {
  const values = points.map((point) => point[series]);
  const peak = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground" data-numeric>
            {total.toLocaleString()}
          </span>{" "}
          over {points.length} days
        </span>
      </figcaption>

      <div
        className="flex h-24 items-end gap-px"
        role="img"
        aria-label={`${label}: ${total} total`}
      >
        {points.map((point) => {
          const value = point[series];
          const height = value === 0 ? 2 : Math.max(4, Math.round((value / peak) * 100));

          return (
            <div
              key={point.date}
              className="group relative flex-1"
              style={{ height: `${height}%` }}
              title={`${formatDayMonth(point.date)}: ${value}`}
            >
              <div
                className={cn(
                  "size-full rounded-sm transition-colors",
                  value === 0 ? "bg-border" : "bg-primary/70 group-hover:bg-primary",
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between font-mono text-2xs text-muted-foreground">
        <span>{formatDayMonth(points[0]?.date ?? Date.now())}</span>
        <span>peak {peak}</span>
        <span>{formatDayMonth(points[points.length - 1]?.date ?? Date.now())}</span>
      </div>
    </figure>
  );
}

export { TrendChart };
