"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Label                                                                     */
/* -------------------------------------------------------------------------- */

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm leading-none font-medium text-foreground",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Field                                                                     */
/* -------------------------------------------------------------------------- */

type FieldContextValue = {
  id: string;
  descriptionId: string;
  errorId: string;
  hasError: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/**
 * Wires a label, control, hint and error message together so the accessible
 * relationships (`htmlFor`, `aria-describedby`, `aria-invalid`) are never
 * hand-maintained at the call site. Wrap any control in this rather than
 * repeating the id plumbing.
 */
function Field({
  children,
  className,
  error,
  id: idProp,
}: {
  children: React.ReactNode;
  className?: string;
  /** Presence of a message puts the field into its invalid state. */
  error?: string;
  id?: string;
}) {
  const generatedId = React.useId();
  const id = idProp ?? generatedId;

  const value = React.useMemo<FieldContextValue>(
    () => ({
      id,
      descriptionId: id + "-description",
      errorId: id + "-error",
      hasError: Boolean(error),
    }),
    [id, error],
  );

  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        {children}
        {error ? (
          <p id={value.errorId} className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function FieldLabel(props: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const field = React.useContext(FieldContext);
  return <Label htmlFor={field?.id} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  const field = React.useContext(FieldContext);
  return (
    <p
      id={field?.descriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Props a control should spread onto itself to join the surrounding Field.
 * Returns an empty object when used outside a Field, so controls stay usable
 * standalone.
 */
function useFieldControl() {
  const field = React.useContext(FieldContext);
  if (!field) return {};
  return {
    id: field.id,
    "aria-invalid": field.hasError || undefined,
    "aria-describedby": field.hasError ? field.errorId : field.descriptionId,
  } as const;
}

export { Field, FieldLabel, FieldDescription, Label, useFieldControl };
