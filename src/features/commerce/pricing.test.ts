import { describe, expect, it } from "vitest";

import {
  computeTotals,
  evaluateCoupon,
  generateOrderNumber,
  type CouponRule,
  type PriceableItem,
} from "@/features/commerce/pricing";

/**
 * Pricing is the one place in the application where getting the arithmetic
 * wrong costs real money in both directions — an over-generous clamp gives
 * courses away, a missing one writes a negative total the database refuses.
 * These tests exercise the rules individually so a regression names itself.
 */

const NOW = new Date("2026-06-15T12:00:00.000Z");

function coupon(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    id: "coupon_1",
    code: "LAUNCH25",
    type: "PERCENT",
    value: 25,
    currency: null,
    minOrderAmount: null,
    maxRedemptions: null,
    redemptionCount: 0,
    perUserLimit: 1,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: null,
    isActive: true,
    courseIds: [],
    ...overrides,
  };
}

const basket: PriceableItem[] = [
  { courseId: "course_a", unitAmount: 4999 },
  { courseId: "course_b", unitAmount: 2999 },
];

const options = { currency: "USD", now: NOW, userRedemptionCount: 0 };

describe("evaluateCoupon", () => {
  it("applies a percentage to the whole basket", () => {
    const result = evaluateCoupon(coupon(), basket, options);

    expect(result.ok).toBe(true);
    // 25% of 7998 = 1999.5, rounded to 2000.
    expect(result.discountAmount).toBe(2000);
    expect(result.appliedTo).toEqual(["course_a", "course_b"]);
  });

  it("applies a fixed amount as given", () => {
    const result = evaluateCoupon(
      coupon({ type: "FIXED", value: 1500, currency: "USD" }),
      basket,
      options,
    );

    expect(result.ok).toBe(true);
    expect(result.discountAmount).toBe(1500);
  });

  it("never discounts more than the items it applies to", () => {
    const result = evaluateCoupon(
      coupon({ type: "FIXED", value: 99_999, currency: "USD" }),
      basket,
      options,
    );

    expect(result.ok).toBe(true);
    expect(result.discountAmount).toBe(7998);
    // The whole point of the clamp: the resulting total is zero, not negative.
    expect(computeTotals(basket, result.discountAmount).totalAmount).toBe(0);
  });

  it("discounts only the courses a scoped coupon names", () => {
    const result = evaluateCoupon(coupon({ value: 50, courseIds: ["course_b"] }), basket, options);

    expect(result.ok).toBe(true);
    expect(result.discountAmount).toBe(1500); // 50% of 2999 -> 1499.5 -> 1500
    expect(result.appliedTo).toEqual(["course_b"]);
  });

  it("rejects a scoped coupon that matches nothing in the basket", () => {
    const result = evaluateCoupon(coupon({ courseIds: ["course_z"] }), basket, options);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_applicable");
    expect(result.discountAmount).toBe(0);
  });

  it("rejects a missing coupon", () => {
    expect(evaluateCoupon(null, basket, options).reason).toBe("not_found");
  });

  it("rejects a deactivated coupon", () => {
    expect(evaluateCoupon(coupon({ isActive: false }), basket, options).reason).toBe("inactive");
  });

  it("rejects a coupon that has not started", () => {
    const future = coupon({ startsAt: new Date("2026-12-01T00:00:00.000Z") });
    expect(evaluateCoupon(future, basket, options).reason).toBe("not_started");
  });

  it("rejects a coupon whose end date has passed", () => {
    const past = coupon({ endsAt: new Date("2026-06-01T00:00:00.000Z") });
    expect(evaluateCoupon(past, basket, options).reason).toBe("expired");
  });

  it("treats the end instant itself as expired", () => {
    const edge = coupon({ endsAt: NOW });
    expect(evaluateCoupon(edge, basket, options).reason).toBe("expired");
  });

  it("rejects a coupon that has hit its global limit", () => {
    const spent = coupon({ maxRedemptions: 100, redemptionCount: 100 });
    expect(evaluateCoupon(spent, basket, options).reason).toBe("exhausted");
  });

  it("rejects a coupon the same user has already redeemed", () => {
    const result = evaluateCoupon(coupon(), basket, { ...options, userRedemptionCount: 1 });
    expect(result.reason).toBe("already_used");
  });

  it("honours a per-user limit above one", () => {
    const twice = coupon({ perUserLimit: 2 });
    expect(evaluateCoupon(twice, basket, { ...options, userRedemptionCount: 1 }).ok).toBe(true);
    expect(evaluateCoupon(twice, basket, { ...options, userRedemptionCount: 2 }).reason).toBe(
      "already_used",
    );
  });

  it("rejects an order below the coupon's minimum", () => {
    const big = coupon({ minOrderAmount: 10_000 });
    expect(evaluateCoupon(big, basket, options).reason).toBe("below_minimum");
  });

  it("judges the minimum on the whole order, not just the eligible items", () => {
    // Eligible subtotal is 2999, but the order is 7998 — above the minimum.
    const scoped = coupon({ minOrderAmount: 5000, courseIds: ["course_b"] });
    expect(evaluateCoupon(scoped, basket, options).ok).toBe(true);
  });

  it("rejects a fixed coupon denominated in another currency", () => {
    const euros = coupon({ type: "FIXED", value: 1000, currency: "EUR" });
    expect(evaluateCoupon(euros, basket, options).reason).toBe("wrong_currency");
  });

  it("lets a percentage coupon apply in any currency", () => {
    const result = evaluateCoupon(coupon(), basket, { ...options, currency: "EUR" });
    expect(result.ok).toBe(true);
  });
});

describe("computeTotals", () => {
  it("sums an undiscounted basket", () => {
    expect(computeTotals(basket)).toEqual({
      subtotalAmount: 7998,
      discountAmount: 0,
      totalAmount: 7998,
    });
  });

  it("keeps total = subtotal - discount, matching the database CHECK", () => {
    const totals = computeTotals(basket, 2000);
    expect(totals.totalAmount).toBe(totals.subtotalAmount - totals.discountAmount);
    expect(totals.totalAmount).toBe(5998);
  });

  it("clamps a discount larger than the basket instead of going negative", () => {
    const totals = computeTotals(basket, 50_000);
    expect(totals.discountAmount).toBe(7998);
    expect(totals.totalAmount).toBe(0);
  });

  it("ignores a negative discount", () => {
    const totals = computeTotals(basket, -500);
    expect(totals.discountAmount).toBe(0);
    expect(totals.totalAmount).toBe(7998);
  });

  it("handles an empty basket", () => {
    expect(computeTotals([], 100)).toEqual({
      subtotalAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    });
  });
});

describe("generateOrderNumber", () => {
  it("matches the quotable reference shape", () => {
    expect(generateOrderNumber()).toMatch(/^CRS-[0-9A-HJ-NP-TV-Z]{4}-[0-9A-HJ-NP-TV-Z]{4}$/);
  });

  it("is not sequential — 500 references collide zero times", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 500; index += 1) seen.add(generateOrderNumber());
    expect(seen.size).toBe(500);
  });
});
