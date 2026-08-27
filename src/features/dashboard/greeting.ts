/**
 * Time-of-day greeting.
 *
 * Computed from the learner's own timezone, not the server's. A dashboard that
 * says "Good evening" to someone eating breakfast is a small thing that reads
 * as the product not knowing who it is talking to.
 */
export function greetingFor(timezone: string, now: Date = new Date()): string {
  let hour: number;

  try {
    // `hourCycle: "h23"` so midnight is 0 rather than 24, which would fall
    // through every branch below and land on "Good evening".
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(now),
    );
  } catch {
    // An unknown or malformed zone must not take the page down over a greeting.
    hour = now.getHours();
  }

  if (!Number.isFinite(hour)) return "Welcome back";
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
