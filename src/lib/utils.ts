import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names, with later Tailwind utilities winning over
 * earlier conflicting ones. Every component takes a `className` prop and runs
 * it through this, so consumers can always override styling at the call site.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
