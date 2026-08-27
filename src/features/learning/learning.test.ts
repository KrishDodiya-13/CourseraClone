import { beforeEach, describe, expect, it } from "vitest";

import { formatTimecode } from "@/lib/format";
import {
  clearLocalPlayback,
  hasCelebrated,
  markCelebrated,
  readLocalPlayback,
  writeLocalPlayback,
} from "@/lib/local-progress";

describe("formatTimecode", () => {
  it("formats under an hour as m:ss", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(9)).toBe("0:09");
    expect(formatTimecode(62)).toBe("1:02");
    // The example from the spec.
    expect(formatTimecode(1122)).toBe("18:42");
  });

  it("formats an hour or more as h:mm:ss", () => {
    expect(formatTimecode(3600)).toBe("1:00:00");
    expect(formatTimecode(3725)).toBe("1:02:05");
  });

  it("floors fractional seconds rather than rounding up", () => {
    // Rounding up would let a resume point exceed the media duration.
    expect(formatTimecode(59.9)).toBe("0:59");
  });

  it("clamps negatives to zero", () => {
    expect(formatTimecode(-30)).toBe("0:00");
  });
});

describe("local playback state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a resume point", () => {
    writeLocalPlayback({ courseId: "c1", lessonId: "l1", timestamp: 1122 });
    const state = readLocalPlayback("c1");
    expect(state?.lessonId).toBe("l1");
    expect(state?.timestamp).toBe(1122);
    expect(state?.updatedAt).toBeTruthy();
  });

  it("keeps courses separate", () => {
    writeLocalPlayback({ courseId: "c1", lessonId: "l1", timestamp: 10 });
    writeLocalPlayback({ courseId: "c2", lessonId: "l9", timestamp: 99 });
    expect(readLocalPlayback("c1")?.lessonId).toBe("l1");
    expect(readLocalPlayback("c2")?.lessonId).toBe("l9");
  });

  it("returns null for a course with nothing stored", () => {
    expect(readLocalPlayback("never-seen")).toBeNull();
  });

  it("ignores a malformed entry instead of throwing", () => {
    window.localStorage.setItem("lumen:playback:c1", "{not json");
    expect(readLocalPlayback("c1")).toBeNull();
  });

  it("ignores an entry missing required fields", () => {
    window.localStorage.setItem("lumen:playback:c1", JSON.stringify({ lessonId: "l1" }));
    expect(readLocalPlayback("c1")).toBeNull();
  });

  it("ages out an entry older than thirty days", () => {
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    window.localStorage.setItem(
      "lumen:playback:c1",
      JSON.stringify({ lessonId: "l1", timestamp: 500, updatedAt: stale }),
    );
    expect(readLocalPlayback("c1")).toBeNull();
  });

  it("clears a stored point", () => {
    writeLocalPlayback({ courseId: "c1", lessonId: "l1", timestamp: 10 });
    clearLocalPlayback("c1");
    expect(readLocalPlayback("c1")).toBeNull();
  });
});

describe("celebration guard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is false before a course has been celebrated", () => {
    expect(hasCelebrated("c1")).toBe(false);
  });

  it("is true afterwards, so a reload does not re-congratulate", () => {
    markCelebrated("c1");
    expect(hasCelebrated("c1")).toBe(true);
  });

  it("is tracked per course", () => {
    markCelebrated("c1");
    expect(hasCelebrated("c2")).toBe(false);
  });
});
