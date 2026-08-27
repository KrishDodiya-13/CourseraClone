import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusShellVariants = cva("flex flex-col items-center justify-center text-center", {
  variants: {
    size: {
      sm: "gap-3 px-4 py-8",
      md: "gap-4 px-6 py-14",
      lg: "gap-5 px-6 py-24",
    },
    bordered: {
      true: "rounded-xl border border-dashed border-border bg-card/40",
    },
  },
  defaultVariants: { size: "md" },
});

const iconTones = {
  neutral: "bg-secondary text-muted-foreground",
  primary: "bg-primary-subtle text-primary-subtle-foreground",
  danger: "bg-danger-subtle text-danger",
  warning: "bg-warning-subtle text-warning-foreground",
} as const;

export interface StatusShellProps
  // `title` is widened to ReactNode, so the native string-only attribute is
  // dropped rather than shadowed.
  extends Omit<React.ComponentProps<"div">, "title">, VariantProps<typeof statusShellVariants> {
  icon?: React.ReactNode;
  iconTone?: keyof typeof iconTones;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * The single layout behind EmptyState, ErrorState and LoadingState.
 *
 * They differ only in iconography, tone and ARIA semantics - keeping the
 * layout here means the three can never drift out of alignment with each
 * other, which is exactly what happens when each is written separately.
 */
function StatusShell({
  icon,
  iconTone = "neutral",
  title,
  description,
  actions,
  size,
  bordered,
  className,
  children,
  ...props
}: StatusShellProps) {
  return (
    <div className={cn(statusShellVariants({ size, bordered }), className)} {...props}>
      {icon ? (
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-full [&_svg]:size-5",
            iconTones[iconTone],
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-md flex-col gap-1.5">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-balance text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
      {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export { StatusShell, statusShellVariants };
