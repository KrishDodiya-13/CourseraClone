import { cn } from "@/lib/utils";

/**
 * Coursera mark: an aperture of four arcs around an open centre - a lens
 * gathering light. Drawn in `currentColor` so it inherits from context.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-6", className)}>
      <circle cx="12" cy="12" r="3.25" className="fill-current" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55">
        <path d="M12 1.8v3.4" />
        <path d="M12 18.8v3.4" />
        <path d="M1.8 12h3.4" />
        <path d="M18.8 12h3.4" />
      </g>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.3">
        <path d="M4.8 4.8 7.2 7.2" />
        <path d="M16.8 16.8l2.4 2.4" />
        <path d="M19.2 4.8 16.8 7.2" />
        <path d="M7.2 16.8 4.8 19.2" />
      </g>
    </svg>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-6 text-primary" />
      <span className="font-display text-lg font-semibold tracking-tight">Coursera</span>
    </span>
  );
}

export { Logo, LogoMark };
