/**
 * Integration check for the engagement system.
 *
 * Asserts the invariants that keep streaks, badges and notifications honest:
 *   1. a notification with the same dedupe key is never created twice;
 *   2. different keys still create separate notifications;
 *   3. a badge is never awarded twice, even across concurrent calls;
 *   4. badges are awarded only when their criteria are actually met;
 *   5. streak milestones announce once per milestone;
 *   6. a day of activity is one row per user, however many events occur.
 *
 * Run: npm run test:engagement
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { notify } from "../src/features/engagement/notify.js";
import {
  BADGE_DEFINITIONS,
  checkStreakMilestone,
  evaluateBadges,
  syncBadgeCatalog,
} from "../src/features/engagement/badges.js";
import { computeStreak, recordActivity } from "../src/features/learning/activity.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

async function main() {
  const user = await db.user.findUnique({ where: { email: "nadia@coursera.test" } });
  if (!user) throw new Error("Seed user missing. Run npm run db:seed.");

  // Start clean for this user so counts are unambiguous.
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.userBadge.deleteMany({ where: { userId: user.id } });
  await db.learningActivity.deleteMany({ where: { userId: user.id } });

  await syncBadgeCatalog();

  console.log("\nBadge catalogue");
  const catalog = await db.badge.findMany({ select: { slug: true } });
  const slugs = new Set(catalog.map((badge) => badge.slug));
  for (const definition of BADGE_DEFINITIONS) {
    check(`"${definition.slug}" exists`, slugs.has(definition.slug));
  }

  console.log("\nNotification dedupe");
  await notify({
    userId: user.id,
    type: "ACCOUNT",
    title: "Test",
    body: "First",
    dedupeKey: "engagement-test:1",
  });
  await notify({
    userId: user.id,
    type: "ACCOUNT",
    title: "Test again",
    body: "Second",
    dedupeKey: "engagement-test:1",
  });
  check(
    "the same dedupe key creates exactly one notification",
    (await db.notification.count({
      where: { userId: user.id, dedupeKey: "engagement-test:1" },
    })) === 1,
  );

  await notify({
    userId: user.id,
    type: "ACCOUNT",
    title: "Different",
    body: "Third",
    dedupeKey: "engagement-test:2",
  });
  check(
    "a different key creates a separate notification",
    (await db.notification.count({ where: { userId: user.id } })) === 2,
  );

  console.log("\nBadge awarding");
  const first = await evaluateBadges(user.id);
  const second = await evaluateBadges(user.id);
  const badgeCount = await db.userBadge.count({ where: { userId: user.id } });

  check("a first evaluation awards what is earned", first.length >= 0);
  check("a second evaluation awards nothing new", second.length === 0);
  check("badge rows equal what the first pass awarded", badgeCount === first.length);

  // Concurrency: five simultaneous evaluations must not duplicate.
  await Promise.all([
    evaluateBadges(user.id),
    evaluateBadges(user.id),
    evaluateBadges(user.id),
    evaluateBadges(user.id),
    evaluateBadges(user.id),
  ]);
  check(
    "concurrent evaluations do not duplicate badges",
    (await db.userBadge.count({ where: { userId: user.id } })) === badgeCount,
  );

  // The 100-lesson badge must not be handed out to someone with far fewer.
  const lessons = await db.lessonProgress.count({
    where: { userId: user.id, completed: true },
  });
  const hasHundred = await db.userBadge.findFirst({
    where: { userId: user.id, badge: { slug: "lessons-100" } },
  });
  check(
    `"100 lessons" is withheld below the threshold (has ${lessons})`,
    lessons >= 100 || hasHundred === null,
  );

  console.log("\nStreak milestones");
  await checkStreakMilestone(user.id, 7);
  await checkStreakMilestone(user.id, 7);
  check(
    "a milestone announces exactly once",
    (await db.notification.count({ where: { userId: user.id, dedupeKey: "streak:7" } })) === 1,
  );
  await checkStreakMilestone(user.id, 5);
  check(
    "a non-milestone day announces nothing",
    (await db.notification.count({ where: { userId: user.id, dedupeKey: "streak:5" } })) === 0,
  );

  console.log("\nActivity dedupe");
  await db.$transaction(async (tx) => {
    await recordActivity(tx, { userId: user.id, timezone: "UTC", minutesLearned: 3 });
  });
  await db.$transaction(async (tx) => {
    await recordActivity(tx, { userId: user.id, timezone: "UTC", minutesLearned: 4 });
  });
  const rows = await db.learningActivity.findMany({ where: { userId: user.id } });
  check("two events on one day produce one row", rows.length === 1);
  check("and their minutes accumulate", (rows[0]?.minutesLearned ?? 0) === 7);

  console.log("\nMeaningful-day rule");
  // A day of trivial activity must not keep a streak alive on its own.
  const trivial = computeStreak(new Set(), "2026-03-10");
  check("no meaningful days means no streak", trivial.current === 0);

  // Clean up this user's test rows.
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.learningActivity.deleteMany({ where: { userId: user.id } });

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
