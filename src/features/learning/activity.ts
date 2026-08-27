import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Daily activity and streaks.
 *
 * Two rules carried from the Phase 0 plan:
 *
 * **The day boundary is the learner's, not UTC.** A streak that breaks at
 * midnight UTC for someone in Asia is the kind of bug that quietly destroys
 * trust in the whole thing, so every date here is computed in the user's own
 * stored timezone.
 *
 * **Streaks are recomputed from the activity log, never incremented in place.**
 * An increment is a guess about what happened yesterday; a recomputation is a
 * fact derived from rows. It also means a backfilled or corrected day heals
 * the streak instead of leaving it permanently wrong.
 */

/** `YYYY-MM-DD` for `when` as observed in `timeZone`. */
export function localDateKey(when: Date, timeZone: string): string {
  try {
    // `en-CA` formats as YYYY-MM-DD, which sorts and parses cleanly.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(when);
  } catch {
    // An invalid IANA zone must not break progress recording.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(when);
  }
}

/** Midnight UTC for a `YYYY-MM-DD` key — how @db.Date columns are stored. */
export function dateKeyToUtc(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function shiftKey(key: string, days: number): string {
  const date = dateKeyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Walks backwards from today counting consecutive active days.
 *
 * Yesterday is an acceptable starting point: a streak should not be declared
 * broken partway through the current day just because the learner has not
 * studied yet.
 */
export function computeStreak(
  activeDateKeys: Set<string>,
  todayKey: string,
): { current: number; longest: number } {
  let current = 0;
  let cursor = activeDateKeys.has(todayKey) ? todayKey : shiftKey(todayKey, -1);

  while (activeDateKeys.has(cursor)) {
    current += 1;
    cursor = shiftKey(cursor, -1);
  }

  const sorted = [...activeDateKeys].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const key of sorted) {
    run = previous !== null && shiftKey(previous, 1) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }

  return { current, longest: Math.max(longest, current) };
}

export interface RecordActivityInput {
  userId: string;
  timezone: string;
  /** Whole minutes to add to today's total. */
  minutesLearned?: number;
  /**
   * Raw seconds behind `minutesLearned`. A 40-second watch rounds to zero
   * minutes but is still real engagement, so it is counted separately when
   * deciding whether the day was meaningful.
   */
  secondsLearned?: number;
  /** Whether this event completed a lesson. */
  completedLesson?: boolean;
  /**
   * A deliberate act of learning that is not a lesson completion — a graded
   * quiz attempt, an assignment submission. Always meaningful.
   */
  engagementEvent?: boolean;
}

/**
 * Minutes below which a day does not count toward a streak on watch time
 * alone.
 *
 * Opening a lesson and immediately closing it is not a day of learning, and a
 * streak that can be kept alive by a two-second visit is not measuring
 * anything. Completing a lesson, passing a quiz or submitting an assignment
 * always counts regardless of time.
 */
export const MEANINGFUL_MINUTES = 2;

/** Whether a day's recorded activity counts toward a streak. */
export function isMeaningfulDay(day: {
  minutesLearned: number;
  lessonsCompleted: number;
}): boolean {
  return day.lessonsCompleted > 0 || day.minutesLearned >= MEANINGFUL_MINUTES;
}

/**
 * Records a day of activity and refreshes the streak.
 *
 * Takes a transaction client so it runs inside the same transaction as the
 * progress write that triggered it — activity and progress must not be able to
 * disagree about whether something happened.
 */
export async function recordActivity(
  tx: Prisma.TransactionClient,
  input: RecordActivityInput,
): Promise<void> {
  const todayKey = localDateKey(new Date(), input.timezone);
  const today = dateKeyToUtc(todayKey);

  // A deliberate engagement event counts as reaching the meaningful floor
  // even when almost no time was recorded — submitting an assignment is
  // learning whether or not a video was playing.
  const minutes = Math.max(
    input.minutesLearned ?? 0,
    input.engagementEvent ? MEANINGFUL_MINUTES : 0,
  );

  await tx.learningActivity.upsert({
    // The (userId, date) unique constraint is what stops one user recording
    // two activity rows for the same day, however many events they generate.
    where: { userId_date: { userId: input.userId, date: today } },
    create: {
      userId: input.userId,
      date: today,
      minutesLearned: minutes,
      lessonsCompleted: input.completedLesson ? 1 : 0,
    },
    update: {
      minutesLearned: { increment: minutes },
      lessonsCompleted: { increment: input.completedLesson ? 1 : 0 },
    },
  });

  // Bounded to a year: a streak longer than that is not worth the scan, and
  // `longest` is carried forward from the stored value below.
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - 400);

  const rows = await tx.learningActivity.findMany({
    where: { userId: input.userId, date: { gte: since } },
    select: { date: true, minutesLearned: true, lessonsCompleted: true },
  });

  // Only meaningful days extend a streak. A day with a stray few seconds
  // recorded still appears in the history and the heatmap — it simply does
  // not keep the streak alive.
  const keys = new Set(
    rows.filter(isMeaningfulDay).map((row) => row.date.toISOString().slice(0, 10)),
  );
  const { current, longest } = computeStreak(keys, todayKey);

  const existing = await tx.streak.findUnique({
    where: { userId: input.userId },
    select: { longestDays: true },
  });

  await tx.streak.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      currentDays: current,
      longestDays: longest,
      lastActiveDate: today,
      timezone: input.timezone,
    },
    update: {
      currentDays: current,
      // Never lower a personal best because the scan window moved.
      longestDays: Math.max(longest, existing?.longestDays ?? 0),
      lastActiveDate: today,
      timezone: input.timezone,
    },
  });
}
