/**
 * Per-device playback state in `localStorage`.
 *
 * This is a convenience layer, not the record. The server holds the truth —
 * this exists so a resume point survives a reload before the first sync lands,
 * and so a brief network failure does not lose the last few seconds.
 *
 * Every access is wrapped: private windows, cleared site data and browsers
 * configured to block storage all throw on access rather than returning null.
 */

const KEY_PREFIX = "lumen:playback:";
const CELEBRATED_PREFIX = "lumen:celebrated:";

export interface LocalPlaybackState {
  courseId: string;
  lessonId: string;
  /** Playback position in seconds. */
  timestamp: number;
  /** ISO 8601, so a stale entry can be aged out. */
  updatedAt: string;
}

/** Entries older than this are ignored — a month-old resume point is noise. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function storageKey(courseId: string): string {
  return `${KEY_PREFIX}${courseId}`;
}

export function readLocalPlayback(courseId: string): LocalPlaybackState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(courseId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LocalPlaybackState>;
    if (
      typeof parsed.lessonId !== "string" ||
      typeof parsed.timestamp !== "number" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    if (Date.now() - new Date(parsed.updatedAt).getTime() > MAX_AGE_MS) return null;

    return {
      courseId,
      lessonId: parsed.lessonId,
      timestamp: parsed.timestamp,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeLocalPlayback(state: Omit<LocalPlaybackState, "updatedAt">): void {
  try {
    const payload: LocalPlaybackState = { ...state, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey(state.courseId), JSON.stringify(payload));
  } catch {
    // Storage unavailable or full. Playback must not break because of it.
  }
}

export function clearLocalPlayback(courseId: string): void {
  try {
    window.localStorage.removeItem(storageKey(courseId));
  } catch {
    // Ignored, as above.
  }
}

/* -------------------------------------------------------------------------- */
/*  Completion celebration                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Whether this device has already celebrated finishing a course.
 *
 * The server tells us when the transition happened; this stops a reload of
 * that same response from congratulating the learner a second time.
 */
export function hasCelebrated(courseId: string): boolean {
  try {
    return window.localStorage.getItem(`${CELEBRATED_PREFIX}${courseId}`) !== null;
  } catch {
    // Failing closed here means "already celebrated", which is the safer of
    // the two wrong answers: a missed celebration beats a repeating one.
    return true;
  }
}

export function markCelebrated(courseId: string): void {
  try {
    window.localStorage.setItem(`${CELEBRATED_PREFIX}${courseId}`, new Date().toISOString());
  } catch {
    // Ignored.
  }
}
