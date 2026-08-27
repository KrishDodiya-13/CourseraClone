import { NextResponse } from "next/server";

import { getSessionUser } from "@/server/authz";
import { getAttemptQuestions } from "@/features/assessment/queries";

/**
 * Questions for an open attempt.
 *
 * A route handler rather than page data, so the question list is fetched when
 * an attempt actually starts — the answer key is not merely hidden in the page
 * payload, it was never in it.
 *
 * `getAttemptQuestions` returns null unless the attempt belongs to the caller
 * and is still in progress, so this cannot be used to read someone else's
 * questions or to replay a graded attempt.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const questions = await getAttemptQuestions(attemptId, user.id);
  if (!questions) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  return NextResponse.json(questions, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
