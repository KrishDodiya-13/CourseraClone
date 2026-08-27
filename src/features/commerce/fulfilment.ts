import "server-only";

import { db } from "@/server/db";
import { routes } from "@/lib/routes";
import { notify } from "@/features/engagement/notify";
import type { PaymentEvent } from "@/features/commerce/provider";

/**
 * Fulfilment — turning a verified payment into access.
 *
 * This is the module the whole commerce design exists to protect. Two rules
 * from the Phase 0 plan are enforced here and nowhere else:
 *
 * **Enrolment is created only by a signature-verified webhook.** The browser
 * returning from the provider is a UI hint, not proof — that URL is trivially
 * visited directly. Nothing on the success page grants anything.
 *
 * **Everything happens in one transaction, keyed on the provider's event id.**
 * Providers retry webhooks until they get a 2xx, so the same event *will*
 * arrive again. The unique constraint on `Payment.providerEventId` is what
 * makes the second arrival a no-op instead of a second enrolment and a second
 * payout credit.
 */

export type FulfilResult =
  | { ok: true; outcome: "fulfilled" | "already_processed" | "ignored"; orderId?: string }
  | { ok: false; reason: "order_not_found" | "amount_mismatch" | "currency_mismatch" };

/**
 * Applies a verified payment event.
 *
 * The event has already had its signature checked by the provider adapter; by
 * the time it reaches here it is known to have come from the provider. What is
 * still not trusted is its *content* — the amount and currency are checked
 * against the order before anything is granted.
 */
export async function fulfilPaymentEvent(
  event: PaymentEvent,
  providerId: "STRIPE" | "RAZORPAY" | "MANUAL",
): Promise<FulfilResult> {
  if (event.kind === "ignored") return { ok: true, outcome: "ignored" };

  // --- idempotency, before anything else --------------------------------
  const seen = await db.payment.findUnique({
    where: { providerEventId: event.eventId },
    select: { id: true, orderId: true },
  });

  if (seen) {
    return { ok: true, outcome: "already_processed", orderId: seen.orderId };
  }

  // --- find the order ----------------------------------------------------
  // By our own id from provider metadata first, then by session. Never by
  // anything the browser supplied.
  const order = await db.order.findFirst({
    where: event.orderId
      ? { id: event.orderId }
      : { providerSessionId: event.sessionId ?? "__none__" },
    select: {
      id: true,
      userId: true,
      status: true,
      totalAmount: true,
      currency: true,
      couponId: true,
      items: {
        select: {
          courseId: true,
          unitAmount: true,
          revenueShareBps: true,
          course: {
            select: {
              slug: true,
              title: true,
              instructors: {
                where: { role: "OWNER" },
                take: 1,
                select: { user: { select: { instructorProfile: { select: { id: true } } } } },
              },
            },
          },
        },
      },
    },
  });

  if (!order) return { ok: false, reason: "order_not_found" };

  if (event.kind === "failed" || event.kind === "expired") {
    await recordUnsuccessful(order.id, event, providerId);
    return { ok: true, outcome: "fulfilled", orderId: order.id };
  }

  if (event.kind === "refunded") {
    await reverseOrder(order.id, event, providerId);
    return { ok: true, outcome: "fulfilled", orderId: order.id };
  }

  // --- the amount the provider reports must match what we asked for -----
  // A provider that says "succeeded" for a smaller amount than the order is
  // either misconfigured or being manipulated; either way it must not grant
  // access to the full basket.
  if (event.amount !== order.totalAmount) {
    await recordUnsuccessful(order.id, event, providerId, "amount_mismatch");
    return { ok: false, reason: "amount_mismatch" };
  }

  if (event.currency.toUpperCase() !== order.currency.toUpperCase()) {
    await recordUnsuccessful(order.id, event, providerId, "currency_mismatch");
    return { ok: false, reason: "currency_mismatch" };
  }

  // --- grant, in one transaction ----------------------------------------
  await db.$transaction(async (tx) => {
    // Re-check inside the transaction: two webhook deliveries can race, and
    // only one may pass this point.
    const current = await tx.order.findUnique({
      where: { id: order.id },
      select: { status: true },
    });
    if (current?.status === "PAID") return;

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: providerId,
        status: "SUCCEEDED",
        providerPaymentId: event.paymentId,
        providerEventId: event.eventId,
        amount: event.amount,
        currency: event.currency.toUpperCase(),
        rawPayload: event.raw as never,
        processedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), expiresAt: null },
    });

    // --- enrolments -----------------------------------------------------
    for (const item of order.items) {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
        select: { id: true, status: true },
      });

      if (existing) {
        // Someone who previously cancelled and has now paid gets reactivated
        // rather than duplicated.
        if (existing.status !== "ACTIVE" && existing.status !== "COMPLETED") {
          await tx.enrollment.update({
            where: { id: existing.id },
            data: { status: "ACTIVE", orderId: order.id, enrolledAt: new Date() },
          });
        }
        continue;
      }

      const enrollment = await tx.enrollment.create({
        data: {
          userId: order.userId,
          courseId: item.courseId,
          status: "ACTIVE",
          source: "PURCHASE",
          orderId: order.id,
        },
        select: { id: true },
      });

      const lessonCount = await tx.lesson.count({ where: { courseId: item.courseId } });
      await tx.courseProgress.create({
        data: { enrollmentId: enrollment.id, totalLessons: lessonCount },
      });

      await tx.course.update({
        where: { id: item.courseId },
        data: { enrollmentCount: { increment: 1 } },
      });

      // --- instructor revenue ------------------------------------------
      // Written in the same transaction, so payouts and revenue analytics
      // read from one ledger that cannot disagree with the order.
      const profileId = item.course.instructors[0]?.user.instructorProfile?.id;
      if (profileId) {
        await tx.instructorPayoutLine.create({
          data: {
            orderId: order.id,
            amount: Math.round((item.unitAmount * item.revenueShareBps) / 10000),
            currency: order.currency,
          },
        });
      }
    }

    // --- coupon redemption ----------------------------------------------
    if (order.couponId) {
      const discount =
        order.items.reduce((sum, item) => sum + item.unitAmount, 0) - order.totalAmount;

      await tx.couponRedemption.create({
        data: {
          couponId: order.couponId,
          userId: order.userId,
          orderId: order.id,
          discountAmount: Math.max(0, discount),
        },
      });

      await tx.coupon.update({
        where: { id: order.couponId },
        data: { redemptionCount: { increment: 1 } },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: order.userId,
        action: "CREATE",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          event: "payment_fulfilled",
          provider: providerId,
          eventId: event.eventId,
          amount: event.amount,
        },
      },
    });
  });

  // Notifications after the transaction: a failure to notify must not undo a
  // paid order.
  await notify({
    userId: order.userId,
    type: "PAYMENT_RECEIPT",
    title: "Payment received",
    body: `Your order is complete. ${order.items.length} course${
      order.items.length === 1 ? "" : "s"
    } added to your learning.`,
    href: routes.orders,
    dedupeKey: `order-paid:${order.id}`,
  });

  for (const item of order.items) {
    await notify({
      userId: order.userId,
      type: "ENROLMENT_CONFIRMED",
      title: "You are enrolled",
      body: item.course.title,
      href: routes.learn(item.course.slug),
      dedupeKey: `enrolled:${item.courseId}`,
    });
  }

  return { ok: true, outcome: "fulfilled", orderId: order.id };
}

/** Records a failed, expired or rejected attempt without granting anything. */
async function recordUnsuccessful(
  orderId: string,
  event: PaymentEvent,
  providerId: "STRIPE" | "RAZORPAY" | "MANUAL",
  reason?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId,
        provider: providerId,
        status: "FAILED",
        providerPaymentId: event.paymentId,
        providerEventId: event.eventId,
        amount: event.amount,
        currency: event.currency.toUpperCase(),
        rawPayload: event.raw as never,
        failureReason: reason ?? event.failureReason ?? event.kind,
        processedAt: new Date(),
      },
    });

    // An order that failed or expired is closed, but only if it has not since
    // been paid by another attempt.
    await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: event.kind === "expired" ? "CANCELLED" : "FAILED" },
    });
  });
}

/** Reverses a refunded order: access revoked, revenue clawed back. */
async function reverseOrder(
  orderId: string,
  event: PaymentEvent,
  providerId: "STRIPE" | "RAZORPAY" | "MANUAL",
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        orderId,
        provider: providerId,
        status: "REFUNDED",
        providerPaymentId: event.paymentId,
        providerEventId: event.eventId,
        amount: event.amount,
        currency: event.currency.toUpperCase(),
        rawPayload: event.raw as never,
        processedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });

    // Access goes away with the money. The enrolments are read first so the
    // denormalised course counter can be decremented by exactly the number
    // that were actually live — a refund processed twice, or one covering an
    // enrolment already revoked, must not push the count below the truth.
    const live = await tx.enrollment.findMany({
      where: { orderId, status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { id: true, courseId: true },
    });

    await tx.enrollment.updateMany({
      where: { id: { in: live.map((enrollment) => enrollment.id) } },
      data: { status: "REFUNDED" },
    });

    for (const enrollment of live) {
      await tx.course.update({
        where: { id: enrollment.courseId },
        data: { enrollmentCount: { decrement: 1 } },
      });
    }

    // The ledger is reversed with a negative line rather than by deleting the
    // original, so the history of what happened stays readable.
    const lines = await tx.instructorPayoutLine.findMany({
      where: { orderId, amount: { gt: 0 } },
      select: { amount: true, currency: true },
    });

    for (const line of lines) {
      await tx.instructorPayoutLine.create({
        data: { orderId, amount: -line.amount, currency: line.currency },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "REFUND",
        entityType: "Order",
        entityId: orderId,
        metadata: { provider: providerId, eventId: event.eventId, amount: event.amount },
      },
    });
  });
}
