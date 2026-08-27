import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/server/authz";
import { recordProgress } from "@/features/learning/progress";

/**
 * Batch progress sync, for work done while offline.
 *
 * Conflict policy, stated plainly because "handle conflicts safely" is the
 * requirement this route exists to satisfy:
 *
 *  - **Position never rewinds.** `recordProgress` takes `max(incoming,
 *    stored)`. A learner who watched to 20:00 on their phone and 05:00 on a
 *    laptop keeps 20:00. A queued event that arrives late cannot drag them
 *    backwards.
 *  - **Completion is monotonic here.** An offline queue may only ever *set*
 *    completion, never clear it. Un-completing is a deliberate online action;
 *    allowing a stale queue entry to do it would silently revoke progress and,
 *    downstream, a certificate.
 *  - **Every entry is applied independently.** One rejected lesson does not
 *    fail the batch, and the response says which ids were accepted so the
 *    client can clear exactly those from its outbox and retry the rest.
 *
 * Nothing here trusts the client's clock for authority — `clientUpdatedAt` is
 * accepted for ordering within the batch only.
 */

const entrySchema = z.object({
  id: z.number().int(),
  lessonId: z.string().min(1),
  positionSeconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24),
  completed: z.boolean().optional(),
  clientUpdatedAt: z.string(),
});

const bodySchema = z.object({
  entries: z.array(entrySchema).min(1).max(200),
});

export interface SyncResult {
  ok: boolean;
  /** Outbox ids the client may now delete. */
  accepted: number[];
  /** Ids that failed and should be retried. */
  rejected: Array<{ id: number; reason: string }>;
  /** Course ids whose completion state changed as a result of this batch. */
  completedCourses: string[];
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Oldest first, so that within one lesson the newest event is applied last
  // and wins on any field where "latest" is the right answer.
  const entries = [...parsed.data.entries].sort(
    (a, b) => Date.parse(a.clientUpdatedAt) - Date.parse(b.clientUpdatedAt),
  );

  const accepted: number[] = [];
  const rejected: Array<{ id: number; reason: string }> = [];
  const completedCourses: string[] = [];

  for (const entry of entries) {
    try {
      const result = await recordProgress({
        userId: user.id,
        lessonId: entry.lessonId,
        positionSeconds: entry.positionSeconds,
        // Only ever `true` or undefined — see the completion rule above.
        completed: entry.completed === true ? true : undefined,
      });

      if (result.ok) {
        accepted.push(entry.id);
        if (result.justCompleted) completedCourses.push(entry.lessonId);
      } else {
        // Enrolment revoked, course unpublished, lesson deleted. Accepting
        // these clears them from the outbox rather than retrying forever.
        accepted.push(entry.id);
      }
    } catch {
      rejected.push({ id: entry.id, reason: "server_error" });
    }
  }

  const result: SyncResult = { ok: true, accepted, rejected, completedCourses };
  return NextResponse.json(result);
}
