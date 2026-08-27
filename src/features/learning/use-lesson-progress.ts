"use client";

import * as React from "react";

import { writeLocalPlayback } from "@/lib/local-progress";
import { saveProgressAction, type ProgressActionResult } from "@/features/learning/actions";

/**
 * Owns progress synchronisation for the lesson being viewed.
 *
 * The requirement this is built around: never a database write per second.
 * Three tiers, deliberately different:
 *
 *   localStorage   every ~2s — free, local, survives a reload
 *   server (idle)  every 15s of playback — the periodic checkpoint
 *   server (event) immediately on pause, seek, completion, page exit
 *
 * The 15s figure is the trade-off: worst case a learner loses 15 seconds of
 * position after a hard crash, against roughly four writes per minute per
 * active learner instead of sixty.
 *
 * Page exit uses `sendBeacon`, because a normal fetch is cancelled when the
 * document goes away and that is precisely the moment the last position
 * matters most.
 */

const SERVER_SYNC_INTERVAL_MS = 15_000;
const LOCAL_SYNC_INTERVAL_MS = 2_000;
/** Below this, a position is not worth restoring — just start from the top. */
const MIN_RESUME_SECONDS = 5;

export interface UseLessonProgressOptions {
  courseId: string;
  courseSlug: string;
  lessonId: string;
  durationSeconds: number;
  initialPositionSeconds: number;
  initialCompleted: boolean;
  onCompletion?: (result: ProgressActionResult) => void;
}

export function useLessonProgress({
  courseId,
  courseSlug,
  lessonId,
  durationSeconds,
  initialPositionSeconds,
  initialCompleted,
  onCompletion,
}: UseLessonProgressOptions) {
  const [completed, setCompleted] = React.useState(initialCompleted);
  const [saving, setSaving] = React.useState(false);

  // Refs rather than state: these change constantly during playback and must
  // not re-render anything.
  const positionRef = React.useRef(initialPositionSeconds);
  const lastServerSyncRef = React.useRef(0);
  const lastLocalSyncRef = React.useRef(0);
  const completedRef = React.useRef(initialCompleted);

  React.useEffect(() => {
    positionRef.current = initialPositionSeconds;
    completedRef.current = initialCompleted;
    setCompleted(initialCompleted);
  }, [lessonId, initialPositionSeconds, initialCompleted]);

  /** Fire-and-forget save that survives the page being torn down. */
  const sendBeacon = React.useCallback(
    (payload: { lessonId: string; positionSeconds: number; completed?: boolean }) => {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        if (navigator.sendBeacon("/api/learn/progress", blob)) return;
      } catch {
        // Fall through to keepalive fetch.
      }
      // `keepalive` lets the request outlive the document when sendBeacon is
      // unavailable or refuses the payload.
      void fetch("/api/learn/progress", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => undefined);
    },
    [],
  );

  const syncToServer = React.useCallback(
    async (options?: { completed?: boolean; force?: boolean }) => {
      const now = Date.now();
      if (!options?.force && now - lastServerSyncRef.current < SERVER_SYNC_INTERVAL_MS) {
        return;
      }
      lastServerSyncRef.current = now;

      setSaving(true);
      try {
        const result = await saveProgressAction({
          lessonId,
          positionSeconds: Math.floor(positionRef.current),
          completed: options?.completed,
          courseSlug,
        });

        if (options?.completed !== undefined) {
          setCompleted(options.completed);
          completedRef.current = options.completed;
        }

        if (result.ok && result.justCompleted) onCompletion?.(result);
        return result;
      } finally {
        setSaving(false);
      }
    },
    [lessonId, courseSlug, onCompletion],
  );

  /** Called on every `timeupdate`. Cheap by design. */
  const reportPosition = React.useCallback(
    (seconds: number) => {
      positionRef.current = seconds;
      const now = Date.now();

      if (now - lastLocalSyncRef.current >= LOCAL_SYNC_INTERVAL_MS) {
        lastLocalSyncRef.current = now;
        writeLocalPlayback({ courseId, lessonId, timestamp: Math.floor(seconds) });
      }

      if (now - lastServerSyncRef.current >= SERVER_SYNC_INTERVAL_MS) {
        void syncToServer();
      }
    },
    [courseId, lessonId, syncToServer],
  );

  /** Pause and seek both warrant an immediate checkpoint. */
  const flush = React.useCallback(() => {
    writeLocalPlayback({ courseId, lessonId, timestamp: Math.floor(positionRef.current) });
    void syncToServer({ force: true });
  }, [courseId, lessonId, syncToServer]);

  const markComplete = React.useCallback(
    async (value = true) => {
      const result = await syncToServer({ completed: value, force: true });
      return result;
    },
    [syncToServer],
  );

  // --- page exit ----------------------------------------------------------
  React.useEffect(() => {
    function handleHidden() {
      if (document.visibilityState !== "hidden") return;
      writeLocalPlayback({ courseId, lessonId, timestamp: Math.floor(positionRef.current) });
      if (positionRef.current > 0) {
        sendBeacon({ lessonId, positionSeconds: Math.floor(positionRef.current) });
      }
    }

    // `visibilitychange` fires on tab switch and on mobile backgrounding;
    // `pagehide` covers navigation and bfcache. Together they cover the cases
    // `beforeunload` alone misses on mobile Safari.
    document.addEventListener("visibilitychange", handleHidden);
    window.addEventListener("pagehide", handleHidden);

    return () => {
      document.removeEventListener("visibilitychange", handleHidden);
      window.removeEventListener("pagehide", handleHidden);
      // Leaving the lesson is itself an exit worth recording.
      if (positionRef.current > 0) {
        sendBeacon({ lessonId, positionSeconds: Math.floor(positionRef.current) });
      }
    };
  }, [courseId, lessonId, sendBeacon]);

  return {
    completed,
    saving,
    reportPosition,
    flush,
    markComplete,
    /** Whether the stored position is far enough in to be worth offering. */
    canResume:
      initialPositionSeconds >= MIN_RESUME_SECONDS &&
      (durationSeconds === 0 || initialPositionSeconds < durationSeconds - 5),
    initialPositionSeconds,
  };
}
