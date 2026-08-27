import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-xl bg-card text-card-foreground", {
  variants: {
    variant: {
      /** Default surface: hairline border, minimal lift. */
      outline: "border border-border shadow-xs",
      /** For content that should read as raised above the page. */
      elevated: "border border-border/60 shadow-md",
      /** Recessed panel for secondary information. */
      muted: "border border-transparent bg-muted",
    },
    interactive: {
      true: "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
    },
  },
  defaultVariants: { variant: "outline" },
});

function Card({
  className,
  variant,
  interactive,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div className={cn(cardVariants({ variant, interactive }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-lg leading-tight font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3 p-5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
