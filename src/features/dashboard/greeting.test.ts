import { describe, expect, it } from "vitest";

import { greetingFor } from "@/features/dashboard/greeting";

/** The zone is the whole point, so the tests vary it rather than the clock. */
describe("greetingFor", () => {
  const at = (iso: string) => new Date(iso);

  it("reads the hour in the learner's zone, not the server's", () => {
    // 03:30 UTC is 09:00 in Kolkata and 22:30 the previous day in Los Angeles.
    const instant = at("2026-08-27T03:30:00.000Z");
    expect(greetingFor("Asia/Kolkata", instant)).toBe("Good morning");
    expect(greetingFor("America/Los_Angeles", instant)).toBe("Good evening");
  });

  it("covers each part of the day", () => {
    expect(greetingFor("UTC", at("2026-08-27T02:00:00.000Z"))).toBe("Still up");
    expect(greetingFor("UTC", at("2026-08-27T08:00:00.000Z"))).toBe("Good morning");
    expect(greetingFor("UTC", at("2026-08-27T14:00:00.000Z"))).toBe("Good afternoon");
    expect(greetingFor("UTC", at("2026-08-27T20:00:00.000Z"))).toBe("Good evening");
  });

  it("treats midnight as 0, not 24", () => {
    expect(greetingFor("UTC", at("2026-08-27T00:15:00.000Z"))).toBe("Still up");
  });

  it("falls back rather than throwing on a bad zone", () => {
    expect(() => greetingFor("Not/AZone", at("2026-08-27T08:00:00.000Z"))).not.toThrow();
  });
});
