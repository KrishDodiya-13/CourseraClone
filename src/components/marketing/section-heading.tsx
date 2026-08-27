import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The heading block that opens each home page band.
 *
 * Exists so the eyebrow / title / description rhythm is defined once — five
 * sections repeating the same three elements by hand is exactly how spacing
 * drifts.
 */
function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Trailing control, e.g. a "View all" link. Hidden when centred. */
  action?: React.ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        centered ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-2", centered && "items-center")}>
        {eyebrow ? (
          <p className="font-mono text-2xs tracking-wide text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
        {description ? (
          <p className={cn("text-base text-muted-foreground", centered ? "max-w-2xl" : "max-w-xl")}>
            {description}
          </p>
        ) : null}
      </div>
      {action && !centered ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionHeading };
