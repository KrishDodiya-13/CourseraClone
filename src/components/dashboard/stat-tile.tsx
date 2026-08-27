import type * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * A single figure.
 *
 * Deliberately not a chart. One number over one period has no shape to plot —
 * a sparkline behind a count of enrolled courses would be decoration standing
 * in for information. The value is the hero; everything else is support.
 */
function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "primary" | "success" | "accent";
  className?: string;
}) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground",
    primary: "bg-primary-subtle text-primary-subtle-foreground",
    success: "bg-success-subtle text-success",
    accent: "bg-accent-subtle text-accent-subtle-foreground",
  } as const;

  return (
    <Card className={cn("flex flex-col gap-2 p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {Icon ? (
          <span className={cn("flex size-7 items-center justify-center rounded-md", tones[tone])}>
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <span className="font-display text-3xl leading-none font-semibold" data-numeric>
        {value}
      </span>

      {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
    </Card>
  );
}

/** Labelled progress bar, used wherever a percentage appears. */
function ProgressBar({
  percent,
  label,
  className,
  size = "md",
}: {
  percent: number;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          clamped === 100 ? "bg-success" : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function SectionHeading({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
      {action}
    </div>
  );
}

export { StatTile, ProgressBar, SectionHeading };
