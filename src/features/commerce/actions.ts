"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/server/db";
import { assertAuth, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";
import { clientEnv } from "@/lib/env";
import { COMMERCE_LIMITS, rateLimit } from "@/server/rate-limit";
import { buildBasket, checkCoupon, createOrder } from "@/features/commerce/orders";
import { getActiveProvider } from "@/features/commerce/providers";
import { COUPON_MESSAGES } from "@/features/commerce/pricing";

/**
 * Checkout actions.
 *
 * The client sends course slugs and, optionally, a coupon code. It does not
 * send prices, discounts or totals — every amount is read from the database
 * here, so a tampered form changes what is bought, never what it costs.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

const couponSchema = z.object({
  code: z.string().trim().min(1).max(64),
  courseSlugs: z.array(z.string().min(1)).min(1).max(20),
});

/** Previews a coupon without creating anything. */
export async function previewCouponAction(input: {
  code: string;
  courseSlugs: string[];
}): Promise<ActionResult<{ discountAmount: number; code: string }>> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a coupon code." };

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: "Sign in first." };
    throw error;
  }

  // Keyed by account rather than by IP: checking a code requires a session, so
  // the account is the thing doing the guessing, and a shared office address
  // should not exhaust one shopper's budget on another's behalf.
  const limit = rateLimit(
    `coupon-preview:${user.id}`,
    COMMERCE_LIMITS.couponPreview.limit,
    COMMERCE_LIMITS.couponPreview.windowMs,
  );

  if (!limit.success) {
    return { ok: false, message: "Too many codes tried. Wait a little and try again." };
  }

  const basket = await buildBasket(user.id, parsed.data.courseSlugs);
  if (basket.items.length === 0) {
    return { ok: false, message: "There is nothing to apply a code to." };
  }

  const evaluation = await checkCoupon(user.id, parsed.data.code, basket);

  if (!evaluation.ok) {
    return {
      ok: false,
      message: evaluation.reason ? COUPON_MESSAGES[evaluation.reason] : "That code cannot be used.",
    };
  }

  return {
    ok: true,
    data: {
      discountAmount: evaluation.discountAmount,
      code: parsed.data.code.trim().toUpperCase(),
    },
  };
}

const checkoutSchema = z.object({
  courseSlugs: z.array(z.string().min(1)).min(1).max(20),
  couponCode: z.string().trim().max(64).optional(),
});

/**
 * Creates an order and starts a provider checkout session.
 *
 * Redirects to the provider. It does **not** grant anything — the order is
 * PENDING until a signature-verified webhook says otherwise.
 */
export async function startCheckoutAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse({
    courseSlugs: formData.getAll("courseSlug").map(String),
    couponCode: (formData.get("couponCode") as string | null) || undefined,
  });

  if (!parsed.success) return { ok: false, message: "That basket is not valid." };

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: "Sign in to complete your purchase." };
    }
    throw error;
  }

  const provider = getActiveProvider();
  if (!provider) {
    return {
      ok: false,
      message: "Payments are not configured on this deployment, so nothing can be purchased yet.",
    };
  }

  const basket = await buildBasket(user.id, parsed.data.courseSlugs);

  if (basket.items.length === 0) {
    const owned = basket.problems.some((problem) => problem.reason === "already_owned");
    return {
      ok: false,
      message: owned
        ? "You already own everything in this basket."
        : "Nothing in this basket can be purchased.",
    };
  }

  // The coupon is re-evaluated at order creation, not taken from the preview.
  // A code that expired between preview and submit must not still apply.
  let discountAmount = 0;
  let couponId: string | undefined;

  if (parsed.data.couponCode) {
    const evaluation = await checkCoupon(user.id, parsed.data.couponCode, basket);
    if (evaluation.ok) {
      discountAmount = evaluation.discountAmount;
      couponId = evaluation.couponId;
    }
    // A now-invalid code is silently dropped rather than blocking the
    // purchase — the total shown on the next screen is the truth.
  }

  const order = await createOrder({ userId: user.id, basket, couponId, discountAmount });

  const base = clientEnv.NEXT_PUBLIC_APP_URL;

  let session;
  try {
    session = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      currency: order.currency,
      customerEmail: user.email,
      items: basket.items.map((item) => ({
        courseId: item.id,
        title: item.title,
        unitAmount: item.priceAmount,
      })),
      successUrl: `${base}${routes.checkoutSuccess}?order=${order.orderNumber}`,
      cancelUrl: `${base}${routes.checkoutCancelled}?order=${order.orderNumber}`,
    });
  } catch (error) {
    console.error("[checkout] provider session failed", error);
    await db.order.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    return { ok: false, message: "The payment page could not be opened. Try again." };
  }

  await db.order.update({
    where: { id: order.id },
    data: { provider: provider.id, providerSessionId: session.sessionId },
  });

  redirect(session.redirectUrl);
}
