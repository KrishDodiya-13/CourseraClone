"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAuth, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";
import { recordProgress, type RecordProgressResult } from "@/features/learning/progress";

/**
 * Progress actions.
 *
 * Thin wrappers: authenticate, validate, delegate. All the logic lives in
 * `progress.ts` so the beacon endpoint shares it exactly.
 */

const schema = z.object({
  lessonId: z.string().min(1),
  positionSeconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 24)
    .optional(),
  completed: z.boolean().optional(),
  courseSlug: z.string().min(1).optional(),
});

export type ProgressActionResult = RecordProgressResult;

const FAILED: ProgressActionResult = {
  ok: false,
  percent: 0,
  completedLessons: 0,
  requiredLessons: 0,
  justCompleted: false,
  courseComplete: false,
};

export async function saveProgressAction(input: {
  lessonId: string;
  positionSeconds?: number;
  completed?: boolean;
  courseSlug?: string;
}): Promise<ProgressActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return FAILED;

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return FAILED;
    throw error;
  }

  const result = await recordProgress({
    userId: user.id,
    lessonId: parsed.data.lessonId,
    positionSeconds: parsed.data.positionSeconds,
    completed: parsed.data.completed,
  });

  // Only revalidate when completion changed. A position save fires every few
  // seconds and must not invalidate the page cache each time.
  if (parsed.data.completed !== undefined && parsed.data.courseSlug) {
    revalidatePath(routes.learn(parsed.data.courseSlug));
    revalidatePath(routes.dashboard);
  }

  return result;
}
