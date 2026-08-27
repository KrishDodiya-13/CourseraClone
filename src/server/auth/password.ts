import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing.
 *
 * Argon2id is the current OWASP recommendation for password storage: it is
 * memory-hard, so a GPU gives an attacker far less advantage than it does
 * against bcrypt or PBKDF2. Parameters below are the OWASP baseline
 * (19 MiB, 2 iterations, 1 degree of parallelism).
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Constant-time comparison against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash, so a corrupted row
 * fails closed as a rejected login instead of a 500.
 */
export async function verifyPassword(hashValue: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashValue, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when no user exists for a submitted email. Without it, "no such
 * account" returns measurably faster than "wrong password", which turns the
 * login form into an account-enumeration oracle.
 */
export async function fakeVerifyDelay(): Promise<void> {
  await verifyPassword(
    "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000",
    "not-a-real-password",
  );
}
