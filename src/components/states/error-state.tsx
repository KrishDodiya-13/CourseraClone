"use client";

import * as React from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusShell, type StatusShellProps } from "@/components/states/status-shell";

export interface ErrorStateProps extends Omit<StatusShellProps, "iconTone" | "title" | "actions"> {
  title?: React.ReactNode;
  /** Wire to a router refresh or an error-boundary `reset`. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions rendered beside the retry button. */
  actions?: React.ReactNode;
}

/**
 * Shown when something failed.
 *
 * The description should say what went wrong and what the user can do about
 * it - never a raw exception message, which leaks internals and helps nobody.
 */
function ErrorState({
  icon = <TriangleAlert aria-hidden="true" />,
  title = "Something went wrong",
  description = "We could not load this just now. Try again, and if it keeps happening let us know.",
  onRetry,
  retryLabel = "Try again",
  actions,
  bordered = true,
  ...props
}: ErrorStateProps) {
  return (
    <StatusShell
      role="alert"
      icon={icon}
      iconTone="danger"
      title={title}
      description={description}
      bordered={bordered}
      actions={
        onRetry || actions ? (
          <>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw aria-hidden="true" />
                {retryLabel}
              </Button>
            ) : null}
            {actions}
          </>
        ) : null
      }
      {...props}
    />
  );
}

export { ErrorState };
