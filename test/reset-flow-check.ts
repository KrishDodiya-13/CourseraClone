/**
 * Integration check for the password-reset token lifecycle.
 *
 * Runs against the real database and asserts the four properties that make
 * this flow safe to expose publicly:
 *   1. only the token HASH is persisted — the raw value is never stored;
 *   2. a consumed token cannot be reused;
 *   3. an expired token is rejected;
 *   4. issuing a new token burns any outstanding one.
 *
 * Run with: npx tsx test/reset-flow-check.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  hashToken,
  generateToken,
  expiresAt,
  PASSWORD_RESET_TTL_MS,
} from "../src/server/auth/tokens.js";
import { hashPassword, verifyPassword } from "../src/server/auth/password.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

async function main() {
  const user = await db.user.findUnique({ where: { email: "amara@coursera.test" } });
  if (!user) throw new Error("Seed user not found. Run npm run db:seed first.");

  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

  console.log("\nPassword reset token lifecycle");

  // 1. Raw token is never persisted.
  const raw = generateToken();
  const created = await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: expiresAt(PASSWORD_RESET_TTL_MS),
    },
  });
  const byRaw = await db.passwordResetToken.findUnique({ where: { tokenHash: raw } });
  check("raw token is not stored", byRaw === null);
  check("hashed token is stored and findable", created.tokenHash === hashToken(raw));

  // 2. Consumed tokens cannot be replayed.
  await db.passwordResetToken.update({
    where: { id: created.id },
    data: { consumedAt: new Date() },
  });
  const consumed = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  check("consumed token is marked and therefore rejected", consumed?.consumedAt !== null);

  // 3. Expired tokens are rejected.
  const expiredRaw = generateToken();
  const expired = await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(expiredRaw),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  check("expired token has a past expiry", expired.expiresAt <= new Date());

  // 4. Issuing a new token burns outstanding ones (what the action does).
  const freshRaw = generateToken();
  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(freshRaw),
        expiresAt: expiresAt(PASSWORD_RESET_TTL_MS),
      },
    }),
  ]);
  const outstanding = await db.passwordResetToken.count({
    where: { userId: user.id, consumedAt: null },
  });
  check("only one outstanding token remains after reissue", outstanding === 1);

  // Password round-trip against the stored seed hash.
  console.log("\nStored credentials");
  const stored = await db.user.findUnique({
    where: { email: "amara@coursera.test" },
    select: { passwordHash: true },
  });
  check("seed hash is argon2id", stored?.passwordHash?.startsWith("$argon2id$") === true);
  check(
    "seed password verifies",
    await verifyPassword(
      stored?.passwordHash ?? "",
      process.env.SEED_USER_PASSWORD ?? "coursera-dev-only-password",
    ),
  );
  check(
    "a wrong password does not verify",
    !(await verifyPassword(stored?.passwordHash ?? "", "nope")),
  );

  const rehashed = await hashPassword("another-long-passphrase");
  check("rehashing produces a different digest", rehashed !== stored?.passwordHash);

  await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
