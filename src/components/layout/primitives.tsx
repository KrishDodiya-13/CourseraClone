import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Container - horizontal measure + gutters                                  */
/* -------------------------------------------------------------------------- */

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      /** Reading measure for prose-heavy pages. */
      prose: "max-w-2xl",
      sm: "max-w-3xl",
      md: "max-w-5xl",
      /** Default application width. */
      lg: "max-w-7xl",
      full: "max-w-none",
    },
  },
  defaultVariants: { size: "lg" },
});

function Container({
  className,
  size,
  asChild,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof containerVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return <Comp className={cn(containerVariants({ size }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/*  Section - vertical rhythm between page bands                              */
/* -------------------------------------------------------------------------- */

const sectionVariants = cva("", {
  variants: {
    spacing: {
      none: "",
      sm: "py-8 sm:py-10",
      md: "py-12 sm:py-16",
      lg: "py-16 sm:py-24",
    },
  },
  defaultVariants: { spacing: "md" },
});

function Section({
  className,
  spacing,
  asChild,
  ...props
}: React.ComponentProps<"section"> & VariantProps<typeof sectionVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "section";
  return <Comp className={cn(sectionVariants({ spacing }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/*  Stack / Inline - the two flex directions, with a shared gap scale         */
/* -------------------------------------------------------------------------- */

const gapScale = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
} as const;

const alignScale = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyScale = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

export interface FlexProps extends React.ComponentProps<"div"> {
  gap?: keyof typeof gapScale;
  align?: keyof typeof alignScale;
  justify?: keyof typeof justifyScale;
  asChild?: boolean;
}

/** Vertical flex column. Use `gap`, never margins on children. */
function Stack({ className, gap = 4, align, justify, asChild, ...props }: FlexProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "flex flex-col",
        gapScale[gap],
        align && alignScale[align],
        justify && justifyScale[justify],
        className,
      )}
      {...props}
    />
  );
}

/** Horizontal flex row that wraps by default. */
function Inline({
  className,
  gap = 3,
  align = "center",
  justify,
  wrap = true,
  asChild,
  ...props
}: FlexProps & { wrap?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "flex",
        wrap && "flex-wrap",
        gapScale[gap],
        alignScale[align],
        justify && justifyScale[justify],
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Grid - responsive column counts without bespoke class strings             */
/* -------------------------------------------------------------------------- */

const gridColumns = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 xs:grid-cols-2 lg:grid-cols-4",
} as const;

function Grid({
  className,
  cols = 3,
  gap = 5,
  ...props
}: React.ComponentProps<"div"> & {
  cols?: keyof typeof gridColumns;
  gap?: keyof typeof gapScale;
}) {
  return <div className={cn("grid", gridColumns[cols], gapScale[gap], className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/*  PageHeader - title band shared by every dashboard and detail page         */
/* -------------------------------------------------------------------------- */

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Buttons or controls aligned to the trailing edge on desktop. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="flex flex-col gap-1.5">
        {eyebrow ? (
          <p className="font-mono text-2xs tracking-wide text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl font-semibold">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export { Container, Section, Stack, Inline, Grid, PageHeader, containerVariants };
