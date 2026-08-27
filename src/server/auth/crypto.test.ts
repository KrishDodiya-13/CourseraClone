import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";
import { generateToken, hashToken, tokensMatch } from "@/server/auth/tokens";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("a-long-enough-passphrase");
    await expect(verifyPassword(hash, "a-long-enough-passphrase")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("a-long-enough-passphrase");
    await expect(verifyPassword(hash, "a-long-enough-passphras")).resolves.toBe(false);
  });

  it("produces an argon2id hash, never the plaintext", async () => {
    const hash = await hashPassword("a-long-enough-passphrase");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("a-long-enough-passphrase");
  });

  it("salts, so the same password hashes differently each time", async () => {
    const [first, second] = await Promise.all([
      hashPassword("a-long-enough-passphrase"),
      hashPassword("a-long-enough-passphrase"),
    ]);
    expect(first).not.toBe(second);
  });

  it("fails closed on a malformed hash rather than throwing", async () => {
    await expect(verifyPassword("not-a-hash", "anything")).resolves.toBe(false);
  });
});

describe("single-use tokens", () => {
  it("generates distinct, high-entropy tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
    // 32 bytes base64url-encoded.
    expect(generateToken()).toHaveLength(43);
  });

  it("hashes deterministically", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces a hash that does not reveal the token", () => {
    const token = generateToken();
    const hashed = hashToken(token);
    expect(hashed).not.toBe(token);
    expect(hashed).toHaveLength(64); // sha256 hex
  });

  it("matches equal digests and rejects different ones", () => {
    const a = hashToken("one");
    const b = hashToken("two");
    expect(tokensMatch(a, a)).toBe(true);
    expect(tokensMatch(a, b)).toBe(false);
  });

  it("rejects digests of differing length without throwing", () => {
    expect(tokensMatch(hashToken("one"), "abcd")).toBe(false);
  });
});
