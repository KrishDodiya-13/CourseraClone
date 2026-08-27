import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/server/authz";
import { recordProgress } from "@/features/learning/progress";

/**
 * Beacon endpoint for progress saved as the page goes away.
 *
 * This exists because `navigator.sendBeacon` cannot invoke a Server Action,
 * and a page being closed or backgrounded is exactly when the last few seconds
 * of playback would otherwise be lost. It is the only reason this route
 * handler exists; the logic is shared with the action.
 *
 * A beacon is trivially forgeable, so this authenticates from the session
 * cookie and `recordProgress` independently re-checks enrolment.
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
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await recordProgress({
    userId: user.id,
    lessonId: parsed.data.lessonId,
    positionSeconds: parsed.data.positionSeconds,
    completed: parsed.data.completed,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
