import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A single, restrained entrance animation for above-the-fold content.
 *
 * Implemented in CSS rather than with an animation library. This is a
 * mount-only fade-and-rise with a stagger delay — there is no gesture, layout
 * or exit animation here for a library to earn its payload on, and measuring
 * proved the point: the same effect via Framer Motion cost 40-70 kB on this
 * route. Reach for a library when Phase 9 brings drag-reordering and shared
 * layout transitions to the course builder, not before.
 *
 * `animation-fill-mode: both` holds the initial state during the delay, and
 * the global `prefers-reduced-motion` rule in `globals.css` collapses the
 * duration so reduced-motion users land on the final state immediately.
 *
 * Stays a server component, so it adds nothing to the client bundle.
 */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Seconds. Stagger siblings by ~0.06 to read as one orchestrated move. */
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-slide-up [animation-fill-mode:both]", className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

export { Reveal };
