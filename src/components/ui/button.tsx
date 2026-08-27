"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-lg font-medium transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-border/70",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:bg-secondary hover:text-secondary-foreground",
        subtle: "bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle/70",
        ghost: "text-foreground hover:bg-secondary hover:text-secondary-foreground",
        danger: "bg-danger text-danger-foreground shadow-xs hover:bg-danger/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-sm [&_svg]:size-3.5",
        md: "h-9.5 px-4 text-sm [&_svg]:size-4",
        lg: "h-11 px-6 text-base [&_svg]:size-4.5",
        icon: "size-9.5 [&_svg]:size-4",
        "icon-sm": "size-8 [&_svg]:size-3.5",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render as the single child element instead of a <button>. */
  asChild?: boolean;
  /** Shows a spinner and blocks interaction. */
  isLoading?: boolean;
  /** Announced to screen readers while `isLoading`. */
  loadingText?: string;
}

function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  isLoading = false,
  loadingText = "Loading",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  // `asChild` hands styling to the child element, so the spinner (which would
  // add a second child and break Slot) is only rendered for real buttons.
  if (asChild) {
    return (
      <Comp className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <button
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          <span className="sr-only">{loadingText}</span>
        </>
      ) : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
