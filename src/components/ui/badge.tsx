import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap",
    "rounded-md font-medium",
    "[&_svg]:pointer-events-none [&_svg]:size-3",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-secondary text-secondary-foreground",
        primary: "bg-primary-subtle text-primary-subtle-foreground",
        accent: "bg-accent-subtle text-accent-subtle-foreground",
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning-foreground",
        danger: "bg-danger-subtle text-danger",
        info: "bg-info-subtle text-info",
        outline: "border border-border text-foreground",
      },
      size: {
        sm: "px-1.5 py-0.5 text-2xs",
        md: "px-2 py-0.5 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, size, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
