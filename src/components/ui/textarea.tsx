"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { controlSurface } from "@/components/ui/input";
import { useFieldControl } from "@/components/ui/field";

function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  const fieldProps = useFieldControl();

  return (
    <textarea
      rows={rows}
      className={cn(controlSurface, "min-h-20 resize-y px-3 py-2 text-base md:text-sm", className)}
      {...fieldProps}
      {...props}
    />
  );
}

export { Textarea };
