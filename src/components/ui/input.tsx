"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useFieldControl } from "@/components/ui/field";

/** Shared surface styling for text-like controls, so Input, Textarea and
 *  Select never drift apart visually. */
const controlSurface = [
  "w-full rounded-lg border border-input bg-card text-foreground shadow-xs",
  "transition-[color,box-shadow,border-color] duration-150",
  "placeholder:text-muted-foreground/70",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
];

export interface InputProps extends React.ComponentProps<"input"> {
  /** Rendered inside the control on the leading edge. */
  startIcon?: React.ReactNode;
  /** Rendered inside the control on the trailing edge. */
  endIcon?: React.ReactNode;
}

function Input({ className, type = "text", startIcon, endIcon, ...props }: InputProps) {
  const fieldProps = useFieldControl();

  const control = (
    <input
      type={type}
      className={cn(
        controlSurface,
        "h-9.5 px-3 py-1 text-base md:text-sm",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        startIcon && "pl-9",
        endIcon && "pr-9",
        className,
      )}
      {...fieldProps}
      {...props}
    />
  );

  if (!startIcon && !endIcon) return control;

  return (
    <div className="relative">
      {startIcon ? (
        <span
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
          aria-hidden="true"
        >
          {startIcon}
        </span>
      ) : null}
      {control}
      {endIcon ? (
        <span
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
          aria-hidden="true"
        >
          {endIcon}
        </span>
      ) : null}
    </div>
  );
}

export { Input, controlSurface };
