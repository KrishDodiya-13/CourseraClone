import "server-only";

/**
 * Fixed-window rate limiting for authentication endpoints.
 *
 * This is an in-memory implementation, and that is a deliberate, temporary
 * choice with a real limitation: the counters live in one process, so on a
 * multi-instance deployment each instance enforces its own limit. It is
 * meaningfully better than nothing for local development and single-instance
 * hosting, and it is wrong to describe it as production-grade.
 *
 * Replacing the body with a Redis sliding window is the intended upgrade and
 * needs no change at any call site — the signature is already what that takes.
 * Until then, treat the limits below as a speed bump, not a control.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Evict expired buckets so a long-running process does not grow unbounded. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { success: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }

  existing.count += 1;
  return {
    success: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Limits tuned for the auth surface. */
export const AUTH_LIMITS = {
  login: { limit: 8, windowMs: 10 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Limits for endpoints that are authenticated but still guessable.
 *
 * A coupon code is a short secret with a real cash value, and checking one is
 * free — which makes the preview endpoint an oracle for enumerating the whole
 * coupon table if it is left unlimited. Twenty attempts an hour is generous for
 * a shopper pasting a code from an email and useless for a script.
 */
export const COMMERCE_LIMITS = {
  couponPreview: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;
