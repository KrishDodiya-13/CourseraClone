import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import type { ActivityDay } from "@/features/dashboard/queries";

/**
 * Learning activity over the last six months.
 *
 * Form: a calendar heatmap, because the question is "which days did I show up",
 * and that is a magnitude read against a date grid — not a trend line. A line
 * chart of minutes-per-day would imply a continuity that daily study does not
 * have.
 *
 * Colour: **sequential, one hue, light to dark**. Five steps of the brand
 * primary plus an explicit empty step. No categorical palette is involved, so
 * there is no colourblind pair-separation problem to solve — a single-hue ramp
 * is monotonic under every form of colour vision. The empty step is the muted
 * surface, so "no activity" reads as absence rather than as a low value.
 *
 * Identity is never colour-alone: every cell carries a text label naming the
 * date and what happened on it, so the grid is fully readable by screen reader
 * and on hover.
 */

/** Five steps, light → dark. Index 0 is "no activity". */
const STEPS = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary/80",
  "bg-primary",
] as const;

/**
 * Buckets minutes into ramp steps.
 *
 * Fixed thresholds rather than a relative scale: a scale normalised to the
 * learner's own maximum would repaint the whole calendar every time they had
 * one long day, which makes two screenshots of the same history disagree.
 */
function stepFor(day: ActivityDay): number {
  if (day.minutesLearned === 0 && day.lessonsCompleted === 0) return 0;
  const weight = day.minutesLearned + day.lessonsCompleted * 5;
  if (weight >= 60) return 5;
  if (weight >= 30) return 4;
  if (weight >= 15) return 3;
  if (weight >= 5) return 2;
  return 1;
}

function describe(day: ActivityDay): string {
  const date = formatDate(`${day.date}T00:00:00Z`);

  if (day.minutesLearned === 0 && day.lessonsCompleted === 0) {
    return `${date}: no activity`;
  }

  const parts: string[] = [];
  if (day.lessonsCompleted > 0) {
    parts.push(`${day.lessonsCompleted} lesson${day.lessonsCompleted === 1 ? "" : "s"}`);
  }
  if (day.minutesLearned > 0) {
    parts.push(`${day.minutesLearned} min`);
  }
  return `${date}: ${parts.join(", ")}`;
}

function ActivityHeatmap({ days, className }: { days: ActivityDay[]; className?: string }) {
  const activeDays = days.filter((day) => stepFor(day) > 0).length;

  // Columns of seven, so each column is a week and each row a weekday.
  const weeks: ActivityDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <Card className={cn("flex min-w-0 flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Learning activity</h2>
        <p className="text-sm text-muted-foreground" data-numeric>
          {activeDays} active {activeDays === 1 ? "day" : "days"} in the last{" "}
          {Math.round(days.length / 7)} weeks
        </p>
      </div>

      {activeDays === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No activity recorded yet. Finish a lesson and this fills in.
        </p>
      ) : (
        <>
          {/* Scrolls on its own so the page never scrolls sideways.
              `min-w-0` is load-bearing: a flex item defaults to
              `min-width: auto`, which lets it grow past its parent to fit the
              grid — `overflow-x-auto` alone does nothing until the box is
              allowed to be narrower than its contents. */}
          <div className="min-w-0 overflow-x-auto pb-1">
            <div
              className="flex gap-1"
              role="img"
              aria-label={`Learning activity: ${activeDays} active days`}
            >
              {weeks.map((week) => (
                <div key={week[0]?.date} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <span
                      key={day.date}
                      title={describe(day)}
                      className={cn(
                        "size-3 rounded-[3px] transition-colors",
                        STEPS[stepFor(day)],
                        stepFor(day) === 0 && "ring-1 ring-border ring-inset",
                      )}
                    >
                      <span className="sr-only">{describe(day)}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend: always present, because the ramp encodes magnitude. */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Less</span>
            <span className="flex gap-1" aria-hidden="true">
              {STEPS.map((step, index) => (
                <span
                  key={step}
                  className={cn(
                    "size-3 rounded-[3px]",
                    step,
                    index === 0 && "ring-1 ring-border ring-inset",
                  )}
                />
              ))}
            </span>
            <span className="text-sm text-muted-foreground">More</span>
          </div>
        </>
      )}
    </Card>
  );
}

export { ActivityHeatmap, stepFor };
