import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Single-use token helpers for password reset and email verification.
 *
 * Only the SHA-256 hash of a token is ever stored. The raw value exists in the
 * emailed link and nowhere else, so a database leak cannot be replayed to take
 * over an account. SHA-256 (not Argon2) is correct here: these tokens are 256
 * bits of CSPRNG output, so there is no low-entropy secret to slow-hash.
 */

/** 32 random bytes, URL-safe. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function tokensMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function expiresAt(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}
