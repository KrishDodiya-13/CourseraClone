import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * The notification hub.
 *
 * Every notification in the product goes through `notify`. Feature code never
 * writes a `Notification` row directly and never talks to an email or push
 * provider — which is what keeps a preference toggle from having to be
 * honoured in fifteen separate places when Phase 13 adds channels.
 *
 * Today there is exactly one channel: in-app. Email and web push slot in here
 * behind the same call.
 */

export type NotifyType =
  | "COURSE_PUBLISHED"
  | "LESSON_ADDED"
  | "ENROLMENT_CONFIRMED"
  | "ASSIGNMENT_REVIEWED"
  | "QUIZ_GRADED"
  | "CERTIFICATE_ISSUED"
  | "STREAK_AT_RISK"
  | "STREAK_MILESTONE"
  | "BADGE_EARNED"
  | "STUDY_REMINDER"
  | "ANNOUNCEMENT"
  | "PAYMENT_RECEIPT"
  | "ACCOUNT";

export interface NotifyInput {
  userId: string;
  type: NotifyType;
  title: string;
  body: string;
  href?: string;
  /**
   * Stops a retried job or a double-submit sending the same thing twice.
   *
   * Unique per user, so it must encode everything that makes this
   * notification distinct — e.g. `quiz-graded:<attemptId>`, not `quiz-graded`.
   */
  dedupeKey?: string;
}

/**
 * Creates a notification, or does nothing if one with the same dedupe key
 * already exists for this user.
 *
 * Takes an optional transaction client so a notification can be written in the
 * same transaction as the thing it announces — a "certificate issued" message
 * should not survive a rolled-back certificate.
 */
export async function notify(input: NotifyInput, tx?: Prisma.TransactionClient): Promise<void> {
  const client = tx ?? db;

  const data = {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    dedupeKey: input.dedupeKey ?? null,
  };

  try {
    // `createMany` with `skipDuplicates` rather than `create` inside a
    // try/catch. Both dedupe correctly, but letting the unique constraint
    // throw makes Prisma log an error for what is a completely normal
    // outcome — and an alarming log line for expected behaviour is how real
    // alerts get ignored.
    await client.notification.createMany({ data: [data], skipDuplicates: true });
  } catch (error) {
    // A notification must never take down the action that triggered it.
    // Outside a transaction we swallow; inside one, rethrow so the caller
    // decides whether the whole operation should fail.
    if (tx) throw error;
    console.error("[notify] failed to create notification", error);
  }
}

/** Fan-out to many users, for course-wide announcements. */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  if (userIds.length === 0) return;

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })),
    // The unique constraint on (userId, dedupeKey) rejects repeats; skipping
    // them means a re-run announces to newly enrolled learners only.
    skipDuplicates: true,
  });
}
