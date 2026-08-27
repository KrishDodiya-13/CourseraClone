"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { assertAuth, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";

/**
 * Wishlist mutations.
 *
 * Persisted in Postgres against `(userId, courseId)`, which is unique — so the
 * wishlist follows a learner across devices and cannot accumulate duplicates
 * from a double-click or a retried request.
 */

export interface WishlistResult {
  ok: boolean;
  /** The state after the toggle, so the client can settle its optimistic UI. */
  wishlisted?: boolean;
  message?: string;
  redirectTo?: string;
}

const inputSchema = z.object({
  courseId: z.string().min(1),
  /** Path to revalidate, so a removal from /wishlist updates the list. */
  revalidate: z.string().optional(),
});

export async function toggleWishlistAction(input: {
  courseId: string;
  revalidate?: string;
}): Promise<WishlistResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That course reference is not valid." };
  }

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, redirectTo: routes.login, message: "Sign in to save courses." };
    }
    throw error;
  }

  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { id: true, slug: true, status: true, deletedAt: true },
  });

  if (!course || course.deletedAt || course.status !== "PUBLISHED") {
    return { ok: false, message: "That course is not available." };
  }

  const existing = await db.wishlist.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { id: true },
  });

  let wishlisted: boolean;

  if (existing) {
    await db.wishlist.delete({ where: { id: existing.id } });
    wishlisted = false;
  } else {
    try {
      await db.wishlist.create({ data: { userId: user.id, courseId: course.id } });
      wishlisted = true;
    } catch (error) {
      // Two rapid clicks can both pass the existence check. The unique
      // constraint settles it, and the outcome is the same either way.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        wishlisted = true;
      } else {
        throw error;
      }
    }
  }

  revalidatePath(routes.course(course.slug));
  revalidatePath(routes.wishlist);
  if (parsed.data.revalidate) revalidatePath(parsed.data.revalidate);

  return { ok: true, wishlisted };
}
