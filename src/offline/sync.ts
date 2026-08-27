"use client";

import {
  deleteOutboxEntries,
  enqueueProgress,
  getPendingProgress,
  markOutboxEntries,
} from "@/offline/db";

/**
 * Progress synchronisation.
 *
 * The queue is drained on three triggers: the browser reporting it is back
 * online, the tab becoming visible again, and an explicit call from the UI.
 * Background Sync would be a fourth, but it is Chromium-only — treating it as
 * the primary mechanism would leave Safari and Firefox users silently
 * unsynced, so it is not used here at all.
 *
 * A drain never runs twice at once. Without that guard, coming back online in
 * two tabs would post the same entries twice, and the server would see
 * duplicate work for no benefit.
 */

let draining = false;

export interface SyncOutcome {
  ok: boolean;
  synced: number;
  remaining: number;
  error?: string;
}

interface SyncResponse {
  ok: boolean;
  accepted: number[];
  rejected: Array<{ id: number; reason: string }>;
}

/** Records progress locally, for the queue to deliver later. */
export async function queueProgress(input: {
  courseId: string;
  lessonId: string;
  positionSeconds: number;
  completed?: boolean;
}): Promise<void> {
  await enqueueProgress({ ...input, clientUpdatedAt: new Date().toISOString() });
}

export async function drainOutbox(): Promise<SyncOutcome> {
  if (draining) return { ok: true, synced: 0, remaining: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const pending = await getPendingProgress();
    return { ok: false, synced: 0, remaining: pending.length, error: "offline" };
  }

  draining = true;

  try {
    const pending = await getPendingProgress();
    if (pending.length === 0) return { ok: true, synced: 0, remaining: 0 };

    const batch = pending.slice(0, 200);
    const ids = batch.map((entry) => entry.id).filter((id): id is number => typeof id === "number");

    await markOutboxEntries(ids, "syncing");

    let response: Response;
    try {
      response = await fetch("/api/learn/progress/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          entries: batch.map((entry) => ({
            id: entry.id,
            lessonId: entry.lessonId,
            positionSeconds: entry.positionSeconds,
            completed: entry.completed,
            clientUpdatedAt: entry.clientUpdatedAt,
          })),
        }),
      });
    } catch {
      // Network died mid-flight. Put them back so the next trigger retries.
      await markOutboxEntries(ids, "pending");
      return { ok: false, synced: 0, remaining: pending.length, error: "network" };
    }

    if (response.status === 401) {
      // Signed out. Keep the queue — it is still valid once they sign back in.
      await markOutboxEntries(ids, "pending");
      return { ok: false, synced: 0, remaining: pending.length, error: "unauthenticated" };
    }

    if (!response.ok) {
      await markOutboxEntries(ids, "failed", `http_${response.status}`);
      return { ok: false, synced: 0, remaining: pending.length, error: "server" };
    }

    const result = (await response.json()) as SyncResponse;

    await deleteOutboxEntries(result.accepted);
    if (result.rejected.length > 0) {
      await markOutboxEntries(
        result.rejected.map((entry) => entry.id),
        "failed",
        result.rejected[0]?.reason,
      );
    }

    const remaining = (await getPendingProgress()).length;
    return { ok: true, synced: result.accepted.length, remaining };
  } finally {
    draining = false;
  }
}

/**
 * Wires the drain triggers. Returns a cleanup function.
 *
 * `online` alone is not enough: the event fires on regaining a network
 * interface, which is not the same as regaining connectivity, and it does not
 * fire at all for a tab that was closed while offline and reopened online.
 */
export function startSyncListeners(onOutcome?: (outcome: SyncOutcome) => void): () => void {
  const run = () => {
    void drainOutbox().then((outcome) => {
      if (outcome.synced > 0 || outcome.error) onOutcome?.(outcome);
    });
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", handleVisibility);

  // Catch the reopened-while-online case.
  run();

  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
