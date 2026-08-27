import "server-only";

import { db } from "@/server/db";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import {
  computeTotals,
  evaluateCoupon,
  generateOrderNumber,
  type CouponEvaluation,
  type CouponRule,
} from "@/features/commerce/pricing";

/**
 * Order creation.
 *
 * Prices are read from the course rows here and snapshotted onto the order.
 * Nothing the client sends about price, discount or total is used — the
 * checkout page posts course ids and a coupon code, and that is all.
 *
 * A PENDING order reserves nothing, so creating one is safe and abandoning one
 * costs nothing.
 */

const CHECKOUT_WINDOW_MINUTES = 60;

export interface PurchasableCourse {
  id: string;
  slug: string;
  title: string;
  priceAmount: number;
  currency: string;
  thumbnailUrl: string | null;
  categoryName: string;
  instructorName: string;
}

export type CartProblem =
  | { courseId: string; reason: "unavailable" }
  | { courseId: string; reason: "already_owned" }
  | { courseId: string; reason: "free" };

export interface CheckoutBasket {
  items: PurchasableCourse[];
  problems: CartProblem[];
  currency: string;
}

/**
 * Resolves course ids into a purchasable basket.
 *
 * Filters out anything the learner already owns, anything unpublished and
 * anything free — a free course is enrolled directly and should never reach a
 * payment provider for a zero-value charge.
 */
export async function buildBasket(userId: string, courseSlugs: string[]): Promise<CheckoutBasket> {
  if (courseSlugs.length === 0) return { items: [], problems: [], currency: DEFAULT_CURRENCY };

  const courses = await db.course.findMany({
    where: { slug: { in: courseSlugs } },
    select: {
      id: true,
      slug: true,
      title: true,
      priceAmount: true,
      currency: true,
      status: true,
      deletedAt: true,
      thumbnailUrl: true,
      category: { select: { name: true } },
      instructors: {
        where: { role: "OWNER" },
        take: 1,
        select: { user: { select: { name: true } } },
      },
      enrollments: {
        where: { userId, status: { in: ["ACTIVE", "COMPLETED"] } },
        take: 1,
        select: { id: true },
      },
    },
  });

  const items: PurchasableCourse[] = [];
  const problems: CartProblem[] = [];

  for (const course of courses) {
    if (course.deletedAt || course.status !== "PUBLISHED") {
      problems.push({ courseId: course.id, reason: "unavailable" });
      continue;
    }
    if (course.enrollments.length > 0) {
      problems.push({ courseId: course.id, reason: "already_owned" });
      continue;
    }
    if (course.priceAmount <= 0) {
      problems.push({ courseId: course.id, reason: "free" });
      continue;
    }

    items.push({
      id: course.id,
      slug: course.slug,
      title: course.title,
      priceAmount: course.priceAmount,
      currency: course.currency,
      thumbnailUrl: course.thumbnailUrl,
      categoryName: course.category.name,
      instructorName: course.instructors[0]?.user.name ?? "Coursera",
    });
  }

  return {
    items,
    problems,
    // A basket must be single-currency; mixing them would make one total
    // meaningless. The first item sets it and the rest are filtered above by
    // the caller when they disagree.
    currency: items[0]?.currency ?? DEFAULT_CURRENCY,
  };
}

/** Loads a coupon and judges it against a basket, server-side. */
export async function checkCoupon(
  userId: string,
  code: string,
  basket: CheckoutBasket,
): Promise<CouponEvaluation & { couponId?: string }> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) {
    return { ok: false, reason: "not_found", discountAmount: 0, appliedTo: [] };
  }

  const coupon = await db.coupon.findUnique({
    where: { code: normalised },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      currency: true,
      minOrderAmount: true,
      maxRedemptions: true,
      redemptionCount: true,
      perUserLimit: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      courses: { select: { id: true } },
    },
  });

  if (!coupon) {
    return { ok: false, reason: "not_found", discountAmount: 0, appliedTo: [] };
  }

  const userRedemptionCount = await db.couponRedemption.count({
    where: { couponId: coupon.id, userId },
  });

  const rule: CouponRule = {
    ...coupon,
    courseIds: coupon.courses.map((course) => course.id),
  };

  const evaluation = evaluateCoupon(
    rule,
    basket.items.map((item) => ({ courseId: item.id, unitAmount: item.priceAmount })),
    { currency: basket.currency, now: new Date(), userRedemptionCount },
  );

  return { ...evaluation, couponId: evaluation.ok ? coupon.id : undefined };
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
}

/**
 * Creates a PENDING order from a server-resolved basket.
 *
 * The order carries a price snapshot per item, so a course repriced between
 * checkout and payment does not change what was agreed.
 */
export async function createOrder(input: {
  userId: string;
  basket: CheckoutBasket;
  couponId?: string;
  discountAmount: number;
}): Promise<CreatedOrder> {
  const totals = computeTotals(
    input.basket.items.map((item) => ({ courseId: item.id, unitAmount: item.priceAmount })),
    input.discountAmount,
  );

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CHECKOUT_WINDOW_MINUTES);

  const order = await db.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: input.userId,
      status: "PENDING",
      subtotalAmount: totals.subtotalAmount,
      discountAmount: totals.discountAmount,
      totalAmount: totals.totalAmount,
      currency: input.basket.currency,
      couponId: input.couponId ?? null,
      expiresAt,
      items: {
        create: input.basket.items.map((item) => ({
          courseId: item.id,
          unitAmount: item.priceAmount,
          titleSnapshot: item.title,
          currency: item.currency,
        })),
      },
    },
    select: { id: true, orderNumber: true, totalAmount: true, currency: true },
  });

  return order;
}

/**
 * Closes PENDING orders whose window has passed.
 *
 * Abandoned checkout is the normal case, not an error: most baskets are never
 * paid for. Reaping them keeps the order list honest and stops a stale session
 * being resumed long after its prices changed.
 */
export async function expireAbandonedOrders(): Promise<number> {
  const result = await db.order.updateMany({
    where: { status: "PENDING", expiresAt: { not: null, lt: new Date() } },
    data: { status: "CANCELLED" },
  });
  return result.count;
}
