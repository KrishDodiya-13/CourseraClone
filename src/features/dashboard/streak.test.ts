import { describe, expect, it } from "vitest";

import {
  MEANINGFUL_MINUTES,
  computeStreak,
  dateKeyToUtc,
  isMeaningfulDay,
  localDateKey,
} from "@/features/learning/activity";
import { stepFor } from "@/components/dashboard/activity-heatmap";

describe("localDateKey", () => {
  it("uses the learner's timezone, not UTC", () => {
    // 22:30 UTC is already the next day in Tokyo. A streak must follow the
    // learner's own day boundary or it breaks at the wrong midnight.
    const instant = new Date("2026-03-10T22:30:00.000Z");
    expect(localDateKey(instant, "UTC")).toBe("2026-03-10");
    expect(localDateKey(instant, "Asia/Tokyo")).toBe("2026-03-11");
  });

  it("also shifts backwards for western zones", () => {
    const instant = new Date("2026-03-11T02:00:00.000Z");
    expect(localDateKey(instant, "America/Los_Angeles")).toBe("2026-03-10");
  });

  it("falls back to UTC for an invalid zone rather than throwing", () => {
    const instant = new Date("2026-03-10T12:00:00.000Z");
    expect(localDateKey(instant, "Not/AZone")).toBe("2026-03-10");
  });
});

describe("dateKeyToUtc", () => {
  it("produces midnight UTC, matching how @db.Date is stored", () => {
    expect(dateKeyToUtc("2026-03-10").toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });
});

describe("computeStreak", () => {
  const today = "2026-03-10";

  it("is zero with no activity", () => {
    expect(computeStreak(new Set(), today)).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive days ending today", () => {
    const days = new Set(["2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(computeStreak(days, today).current).toBe(3);
  });

  it("still counts a streak that ended yesterday", () => {
    // The day is not over. Declaring the streak broken before the learner has
    // had a chance to study today is the classic streak bug.
    const days = new Set(["2026-03-08", "2026-03-09"]);
    expect(computeStreak(days, today).current).toBe(2);
  });

  it("breaks when the gap is two days", () => {
    const days = new Set(["2026-03-07", "2026-03-08"]);
    expect(computeStreak(days, today).current).toBe(0);
  });

  it("ignores a gap in the middle when counting the current run", () => {
    const days = new Set(["2026-03-01", "2026-03-02", "2026-03-09", "2026-03-10"]);
    expect(computeStreak(days, today).current).toBe(2);
  });

  it("reports the longest run across all history", () => {
    const days = new Set(["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-03-10"]);
    const result = computeStreak(days, today);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(4);
  });

  it("never reports a longest shorter than the current run", () => {
    const days = new Set(["2026-03-08", "2026-03-09", "2026-03-10"]);
    const result = computeStreak(days, today);
    expect(result.longest).toBeGreaterThanOrEqual(result.current);
  });

  it("handles a run crossing a month boundary", () => {
    const days = new Set(["2026-02-27", "2026-02-28", "2026-03-01"]);
    expect(computeStreak(days, "2026-03-01").current).toBe(3);
  });
});

describe("activity heatmap bucketing", () => {
  const day = (minutesLearned: number, lessonsCompleted = 0) => ({
    date: "2026-03-10",
    minutesLearned,
    lessonsCompleted,
  });

  it("puts an empty day in the zero step", () => {
    expect(stepFor(day(0, 0))).toBe(0);
  });

  it("gives any activity at least step one", () => {
    expect(stepFor(day(1))).toBe(1);
    expect(stepFor(day(0, 1))).toBeGreaterThan(0);
  });

  it("increases monotonically with effort", () => {
    const steps = [day(1), day(6), day(20), day(35), day(90)].map(stepFor);
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]!).toBeGreaterThanOrEqual(steps[index - 1]!);
    }
  });

  it("caps at the darkest step", () => {
    expect(stepFor(day(10_000, 50))).toBe(5);
  });

  it("weights a completed lesson above a bare minute", () => {
    expect(stepFor(day(0, 1))).toBeGreaterThan(stepFor(day(1, 0)));
  });
});

describe("meaningful-day rule", () => {
  it("counts a day with a completed lesson regardless of time", () => {
    // Completing a lesson is the act; how long it took is not the point.
    expect(isMeaningfulDay({ minutesLearned: 0, lessonsCompleted: 1 })).toBe(true);
  });

  it("counts a day with enough watch time and no completion", () => {
    expect(isMeaningfulDay({ minutesLearned: MEANINGFUL_MINUTES, lessonsCompleted: 0 })).toBe(true);
  });

  it("rejects a day of trivial activity", () => {
    // Opening a lesson and closing it is not a day of learning. A streak that
    // survives a two-second visit is not measuring anything.
    expect(isMeaningfulDay({ minutesLearned: 1, lessonsCompleted: 0 })).toBe(false);
    expect(isMeaningfulDay({ minutesLearned: 0, lessonsCompleted: 0 })).toBe(false);
  });

  it("streaks count only meaningful days", () => {
    const days = [
      { date: "2026-03-08", minutesLearned: 30, lessonsCompleted: 1 },
      { date: "2026-03-09", minutesLearned: 1, lessonsCompleted: 0 },
      { date: "2026-03-10", minutesLearned: 20, lessonsCompleted: 1 },
    ];
    const meaningful = new Set(days.filter(isMeaningfulDay).map((day) => day.date));

    // The 9th was trivial, so the run breaks there rather than reading as 3.
    expect(computeStreak(meaningful, "2026-03-10").current).toBe(1);
  });
});
