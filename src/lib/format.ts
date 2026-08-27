/**
 * Display formatters.
 *
 * Money is handled as integer minor units throughout (the Phase 0 rule), so
 * every price formatter divides by 100 at the very last moment and never
 * earlier — no float arithmetic touches an amount.
 */

/**
 * Money formatters live in `@/lib/currency` and are re-exported here so the
 * dozens of existing `@/lib/format` imports keep working. New code can import
 * from either; there is one implementation behind both.
 */
export {
  formatPrice,
  formatCoursePrice,
  discountPercent,
  savingsAmount,
  currencySymbol,
  DEFAULT_CURRENCY,
  CURRENCY_LOCALE,
} from "@/lib/currency";

/** Compact counts for social proof: 1200 -> "1.2K", 45000 -> "45K". */
export function formatCompact(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Minutes as course length: 95 -> "1h 35m", 45 -> "45m". */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** One decimal place, always — "4.0" rather than "4". */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Playback timecode: `m:ss`, or `h:mm:ss` once past an hour.
 *
 * Seconds are floored, never rounded — rounding up would let a resume point
 * sit past the end of the media it refers to.
 */
export function formatTimecode(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dates are formatted with an explicit locale and time zone, always.
 *
 * `toLocaleDateString(undefined, …)` resolves against the *host's* locale and
 * zone — which is Node on the server and the browser on the client. Those
 * disagree, and the disagreement surfaces as a React hydration mismatch that
 * moves between pages depending on which one happens to render a date. Twelve
 * call sites were doing exactly that.
 *
 * Pinning both makes the output deterministic. `Asia/Kolkata` because the
 * platform prices and sells in India; a receipt or an audit entry should read
 * in one fixed zone rather than in whatever zone the viewer's laptop is set to,
 * which is also the more defensible choice for a record.
 */
const DATE_LOCALE = "en-IN";
const DATE_ZONE = "Asia/Kolkata";

/** "27 August 2026" */
export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: DATE_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

/** "27 Aug 2026" — for tables and dense lists. */
export function formatShortDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: DATE_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/** "27 Aug 2026, 03:45 pm" — where the time of day carries information. */
export function formatDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: DATE_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** "27 Aug" — axis labels and other places the year is implied. */
export function formatDayMonth(value: string | number | Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: DATE_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
