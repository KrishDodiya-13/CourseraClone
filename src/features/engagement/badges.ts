import "server-only";

import { db } from "@/server/db";
import { notify } from "@/features/engagement/notify";
import { recordActivity } from "@/features/learning/activity";

/**
 * Badge awarding.
 *
 * Criteria live here as data, not as scattered `if` statements, so the full
 * set of what can be earned is readable in one place and evaluating them is a
 * single pass.
 *
 * Duplicates are impossible by construction: `UserBadge` is unique on
 * (userId, badgeId), and the award path treats a unique violation as "already
 * had it" rather than an error. Two concurrent requests cannot both award.
 */

export type BadgeCriteria =
  | { kind: "lessons_completed"; threshold: number }
  | { kind: "courses_completed"; threshold: number }
  | { kind: "streak_days"; threshold: number };

export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  criteria: BadgeCriteria;
}

/**
 * The canonical badge set.
 *
 * This is the source of truth — the seed writes it and `syncBadgeCatalog`
 * reconciles the database with it, so adding a badge is a change here and
 * nowhere else.
 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    slug: "first-lesson",
    name: "First Lesson",
    description: "Completed your first lesson.",
    iconKey: "footprints",
    tier: "BRONZE",
    criteria: { kind: "lessons_completed", threshold: 1 },
  },
  {
    slug: "first-course",
    name: "First Course Completed",
    description: "Finished a course from beginning to end.",
    iconKey: "award",
    tier: "GOLD",
    criteria: { kind: "courses_completed", threshold: 1 },
  },
  {
    slug: "streak-3",
    name: "3-Day Streak",
    description: "Learned on three consecutive days.",
    iconKey: "flame",
    tier: "BRONZE",
    criteria: { kind: "streak_days", threshold: 3 },
  },
  {
    slug: "streak-7",
    name: "7-Day Streak",
    description: "Learned on seven consecutive days.",
    iconKey: "flame",
    tier: "SILVER",
    criteria: { kind: "streak_days", threshold: 7 },
  },
  {
    slug: "streak-30",
    name: "30-Day Streak",
    description: "Learned every day for a month.",
    iconKey: "flame",
    tier: "GOLD",
    criteria: { kind: "streak_days", threshold: 30 },
  },
  {
    slug: "lessons-100",
    name: "100 Lessons Completed",
    description: "Completed one hundred lessons.",
    iconKey: "trophy",
    tier: "PLATINUM",
    criteria: { kind: "lessons_completed", threshold: 100 },
  },
];

/** Creates or updates every defined badge. Idempotent. */
export async function syncBadgeCatalog(): Promise<void> {
  for (const badge of BADGE_DEFINITIONS) {
    await db.badge.upsert({
      where: { slug: badge.slug },
      create: {
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        iconKey: badge.iconKey,
        tier: badge.tier,
        criteria: badge.criteria,
      },
      update: {
        name: badge.name,
        description: badge.description,
        iconKey: badge.iconKey,
        tier: badge.tier,
        criteria: badge.criteria,
      },
    });
  }
}

export interface AwardedBadge {
  slug: string;
  name: string;
  description: string;
}

/**
 * Evaluates every criterion against the learner's current standing and awards
 * whatever they now qualify for.
 *
 * Called after progress is recorded. It reads counts rather than reacting to
 * the specific event, so a badge cannot be missed because the event that would
 * have triggered it was lost — the next qualifying action picks it up.
 */
export async function evaluateBadges(userId: string): Promise<AwardedBadge[]> {
  const [lessonsCompleted, coursesCompleted, streak, existing, catalog] = await Promise.all([
    db.lessonProgress.count({ where: { userId, completed: true } }),
    db.enrollment.count({ where: { userId, status: "COMPLETED" } }),
    db.streak.findUnique({
      where: { userId },
      select: { currentDays: true, longestDays: true },
    }),
    db.userBadge.findMany({ where: { userId }, select: { badge: { select: { slug: true } } } }),
    db.badge.findMany({ select: { id: true, slug: true, name: true, description: true } }),
  ]);

  const held = new Set(existing.map((row) => row.badge.slug));
  const bySlug = new Map(catalog.map((badge) => [badge.slug, badge]));

  // The best streak ever reached, so a badge earned during a streak is not
  // lost when that streak later breaks.
  const bestStreak = Math.max(streak?.currentDays ?? 0, streak?.longestDays ?? 0);

  const qualifies = (criteria: BadgeCriteria): boolean => {
    switch (criteria.kind) {
      case "lessons_completed":
        return lessonsCompleted >= criteria.threshold;
      case "courses_completed":
        return coursesCompleted >= criteria.threshold;
      case "streak_days":
        return bestStreak >= criteria.threshold;
      default:
        return false;
    }
  };

  const awarded: AwardedBadge[] = [];

  for (const definition of BADGE_DEFINITIONS) {
    if (held.has(definition.slug)) continue;
    if (!qualifies(definition.criteria)) continue;

    const badge = bySlug.get(definition.slug);
    if (!badge) continue;

    try {
      await db.userBadge.create({ data: { userId, badgeId: badge.id } });
    } catch (error) {
      // Unique violation: another request awarded it first. Not an error.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        continue;
      }
      throw error;
    }

    awarded.push({
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
    });

    await notify({
      userId,
      type: "BADGE_EARNED",
      title: `Badge earned: ${definition.name}`,
      body: definition.description,
      href: "/profile",
      // One notification per badge, ever.
      dedupeKey: `badge:${definition.slug}`,
    });
  }

  return awarded;
}

/** Streak lengths worth telling someone about. */
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

/**
 * Notifies on reaching a streak milestone.
 *
 * Deduped on the milestone value, so re-reaching 7 days after a break does not
 * announce it again — the first time is the achievement.
 */
export async function checkStreakMilestone(userId: string, currentDays: number): Promise<void> {
  if (!STREAK_MILESTONES.includes(currentDays as (typeof STREAK_MILESTONES)[number])) return;

  await notify({
    userId,
    type: "STREAK_MILESTONE",
    title: `${currentDays} day learning streak`,
    body: `You have learned on ${currentDays} days in a row. Keep it going.`,
    href: "/dashboard/progress",
    dedupeKey: `streak:${currentDays}`,
  });
}

/**
 * Records a deliberate act of learning that completes nothing.
 *
 * A failed quiz attempt is engagement — the learner turned up and tried. It
 * keeps a streak alive without inflating any completion count.
 */
export async function recordEngagement(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  await db.$transaction(async (tx) => {
    await recordActivity(tx, {
      userId,
      timezone: user?.timezone ?? "UTC",
      engagementEvent: true,
    });
  });

  await evaluateBadges(userId);
}
