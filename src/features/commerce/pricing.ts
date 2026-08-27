/**
 * Order pricing.
 *
 * Pure functions, no database and no request context, because this is where
 * money is decided and it needs to be exhaustively testable. Every amount is
 * an integer of minor units — the Phase 0 rule — so no float ever touches a
 * total.
 *
 * Nothing here reads a price from the client. Callers pass the prices they
 * looked up server-side; these functions only combine them.
 */

export type CouponType = "PERCENT" | "FIXED";

export interface PriceableItem {
  courseId: string;
  /** Integer minor units, read from the course row. */
  unitAmount: number;
}

export interface CouponRule {
  id: string;
  code: string;
  type: CouponType;
  /** PERCENT: 1-100. FIXED: minor units. */
  value: number;
  currency: string | null;
  minOrderAmount: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  perUserLimit: number;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
  /** Empty means the coupon applies to the whole catalogue. */
  courseIds: string[];
}

export type CouponRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "already_used"
  | "below_minimum"
  | "wrong_currency"
  | "not_applicable";

export interface CouponEvaluation {
  ok: boolean;
  reason?: CouponRejection;
  /** Discount in minor units. Zero when rejected. */
  discountAmount: number;
  /** The items the discount actually applied to. */
  appliedTo: string[];
}

export const COUPON_MESSAGES: Record<CouponRejection, string> = {
  not_found: "That code is not recognised.",
  inactive: "That code is no longer active.",
  not_started: "That code is not valid yet.",
  expired: "That code has expired.",
  exhausted: "That code has been fully redeemed.",
  already_used: "You have already used that code.",
  below_minimum: "Your order is below the minimum for that code.",
  wrong_currency: "That code cannot be used in this currency.",
  not_applicable: "That code does not apply to anything in your basket.",
};

/**
 * Decides whether a coupon applies and what it is worth.
 *
 * Every rule is checked here rather than at the call site, so the checkout
 * page, the order-creation path and any future admin preview all reach the
 * same verdict. `now` and `userRedemptionCount` are parameters rather than
 * ambient reads, which is what makes expiry and per-user limits testable.
 */
export function evaluateCoupon(
  coupon: CouponRule | null,
  items: PriceableItem[],
  options: { currency: string; now: Date; userRedemptionCount: number },
): CouponEvaluation {
  const none: CouponEvaluation = { ok: false, discountAmount: 0, appliedTo: [] };

  if (!coupon) return { ...none, reason: "not_found" };
  if (!coupon.isActive) return { ...none, reason: "inactive" };
  if (coupon.startsAt > options.now) return { ...none, reason: "not_started" };
  if (coupon.endsAt !== null && coupon.endsAt <= options.now) {
    return { ...none, reason: "expired" };
  }

  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { ...none, reason: "exhausted" };
  }

  if (options.userRedemptionCount >= coupon.perUserLimit) {
    return { ...none, reason: "already_used" };
  }

  // A fixed-amount coupon is denominated in a currency; applying a $10 coupon
  // to a euro order would silently change its value.
  if (coupon.type === "FIXED" && coupon.currency !== null && coupon.currency !== options.currency) {
    return { ...none, reason: "wrong_currency" };
  }

  // A scoped coupon discounts only the items it names.
  const eligible =
    coupon.courseIds.length === 0
      ? items
      : items.filter((item) => coupon.courseIds.includes(item.courseId));

  if (eligible.length === 0) return { ...none, reason: "not_applicable" };

  const eligibleSubtotal = eligible.reduce((sum, item) => sum + item.unitAmount, 0);
  const orderSubtotal = items.reduce((sum, item) => sum + item.unitAmount, 0);

  // The minimum is judged on the whole order, which is what a shopper sees.
  if (coupon.minOrderAmount !== null && orderSubtotal < coupon.minOrderAmount) {
    return { ...none, reason: "below_minimum" };
  }

  const raw =
    coupon.type === "PERCENT" ? Math.round((eligibleSubtotal * coupon.value) / 100) : coupon.value;

  // A discount can never exceed what it applies to. Without this clamp a
  // fixed-amount coupon larger than the basket would produce a negative
  // total — which the database CHECK constraint would reject, turning a
  // pricing bug into a 500 at the worst possible moment.
  const discountAmount = Math.max(0, Math.min(raw, eligibleSubtotal));

  return {
    ok: true,
    discountAmount,
    appliedTo: eligible.map((item) => item.courseId),
  };
}

export interface OrderTotals {
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

/**
 * Computes the three amounts stored on an order.
 *
 * The database enforces `total = subtotal - discount` with a CHECK
 * constraint, so this function and that constraint have to agree exactly.
 * Both are integer arithmetic for that reason.
 */
export function computeTotals(items: PriceableItem[], discountAmount = 0): OrderTotals {
  const subtotalAmount = items.reduce((sum, item) => sum + item.unitAmount, 0);
  const clamped = Math.max(0, Math.min(discountAmount, subtotalAmount));

  return {
    subtotalAmount,
    discountAmount: clamped,
    totalAmount: subtotalAmount - clamped,
  };
}

/**
 * Human-quotable order reference, e.g. `CRS-7K3F-9QP2`.
 *
 * Deliberately not sequential: an incrementing order number tells every
 * customer how many orders the business has taken, and lets anyone probe for
 * neighbouring orders.
 */
const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateOrderNumber(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  let body = "";
  for (const byte of bytes) {
    body += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }

  return `CRS-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}
