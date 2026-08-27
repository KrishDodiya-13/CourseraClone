"use client";

import * as React from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/** Form-level error or confirmation, announced to assistive tech. */
function FormMessage({
  message,
  tone = "error",
}: {
  message?: string;
  tone?: "error" | "success";
}) {
  if (!message) return null;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "error"
          ? "border-danger/30 bg-danger-subtle text-danger"
          : "border-success/30 bg-success-subtle text-success",
      )}
    >
      {tone === "error" ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{message}</span>
    </div>
  );
}

/** Password input with a show/hide toggle. */
function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/**
 * Google sign-in.
 *
 * Rendered only when the server reports the provider is configured — an
 * unconfigured button that fails on click is worse than no button.
 */
function GoogleButton({
  enabled,
  callbackUrl,
  label = "Continue with Google",
}: {
  enabled: boolean;
  callbackUrl?: string;
  label?: string;
}) {
  if (!enabled) return null;

  const href = `/api/auth/signin/google${
    callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""
  }`;

  return (
    <>
      <Button variant="outline" fullWidth asChild>
        <a href={href}>
          {/* Neutral mark: no third-party brand asset ships in this repo. */}
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 4.5a7.5 7.5 0 1 0 7.28 9.32h-7.03v-2.9h9.94c.1.55.16 1.12.16 1.71 0 5.7-3.82 9.87-9.85 9.87A10.5 10.5 0 1 1 12 1.5a10.1 10.1 0 0 1 7.05 2.75l-2.2 2.12A6.98 6.98 0 0 0 12 4.5Z"
            />
          </svg>
          {label}
        </a>
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">or</span>
        <Separator className="flex-1" />
      </div>
    </>
  );
}

/** Captured so streaks use the learner's own day boundary, not UTC. */
function TimezoneField() {
  const [timezone, setTimezone] = React.useState("UTC");

  React.useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTimezone("UTC");
    }
  }, []);

  return <input type="hidden" name="timezone" value={timezone} />;
}

export { FormMessage, PasswordInput, GoogleButton, TimezoneField };
