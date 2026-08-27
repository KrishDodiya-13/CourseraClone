import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * TEMPORARY, ONE-TIME-USE endpoint to seed the production database with the
 * real course catalogue. Protected by ADMIN_SEED_SECRET (set only in Vercel's
 * environment variables, never committed). Delete this route once the
 * production database has been seeded.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret") ?? req.nextUrl.searchParams.get("secret");
  const expected = process.env.ADMIN_SEED_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "ADMIN_SEED_SECRET is not configured" }, { status: 500 });
  }
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runProductionSeed } = await import("../../../../../prisma/seed-production");
    await runProductionSeed(true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
