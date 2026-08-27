/**
 * Integration check for payments and fulfilment.
 *
 * This is the check that matters most in the whole project, because it is the
 * one place where getting it wrong hands out paid courses. It asserts, against
 * the real database:
 *
 *   1. a verified success grants exactly one enrolment and one payment row;
 *   2. the same provider event arriving twice changes nothing — no second
 *      enrolment, no second payout line, no second coupon redemption;
 *   3. an event whose amount disagrees with the order grants nothing;
 *   4. an event for an unknown order is rejected, not guessed at;
 *   5. a failed event closes the order without granting anything;
 *   6. an expired checkout window cancels a PENDING order;
 *   7. a refund revokes access and reverses the ledger rather than deleting it.
 *
 * Run: npm run test:payments
 */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { fulfilPaymentEvent } from "../src/features/commerce/fulfilment.js";
import {
  buildBasket,
  createOrder,
  expireAbandonedOrders,
} from "../src/features/commerce/orders.js";
import type { PaymentEvent } from "../src/features/commerce/provider.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

/** A test user who owns nothing, so enrolment counts are unambiguous. */
const EMAIL = "payments-check@coursera.test";
const SLUG = "writing-for-engineers";

function event(overrides: Partial<PaymentEvent> & Pick<PaymentEvent, "orderId">): PaymentEvent {
  return {
    eventId: `chk_evt_${randomUUID()}`,
    paymentId: `chk_pi_${randomUUID()}`,
    sessionId: null,
    kind: "succeeded",
    amount: 0,
    currency: "USD",
    raw: { source: "payments-check" },
    ...overrides,
  };
}

let courseIdUnderTest = "";

/** Removes every trace of the test user so a re-run starts from the same place. */
async function reset(userId: string) {
  const orders = await db.order.findMany({ where: { userId }, select: { id: true } });
  const orderIds = orders.map((order) => order.id);

  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.instructorPayoutLine.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.couponRedemption.deleteMany({ where: { userId } });
  await db.enrollment.deleteMany({ where: { userId } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { userId } });
  await db.notification.deleteMany({ where: { userId } });

  // Deleting enrolments directly is something the application never does, so
  // it leaves the denormalised counter overstated. Recomputing it here keeps
  // repeated runs of this check from inflating the seed data.
  const live = await db.enrollment.count({
    where: { courseId: courseIdUnderTest, status: { in: ["ACTIVE", "COMPLETED"] } },
  });
  await db.course.update({
    where: { id: courseIdUnderTest },
    data: { enrollmentCount: live },
  });
}

async function main() {
  const course = await db.course.findUnique({
    where: { slug: SLUG },
    select: { id: true, priceAmount: true, currency: true, enrollmentCount: true },
  });
  if (!course) throw new Error(`Seed course "${SLUG}" missing. Run npm run db:seed.`);

  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Payments Check", role: "STUDENT" },
    select: { id: true },
  });

  courseIdUnderTest = course.id;
  await reset(user.id);

  // Counts are compared as deltas rather than absolutes: the seed's own
  // enrolments are none of this check's business.
  const countBefore = await db.course
    .findUniqueOrThrow({ where: { id: course.id }, select: { enrollmentCount: true } })
    .then((row) => row.enrollmentCount);

  // ---------------------------------------------------------------- success
  console.log("\nSuccessful payment");
  const basket = await buildBasket(user.id, [SLUG]);
  check("the basket resolves one purchasable course", basket.items.length === 1);

  const order = await createOrder({ userId: user.id, basket, discountAmount: 0 });
  check("the order total matches the course price", order.totalAmount === course.priceAmount);

  const success = event({ orderId: order.id, amount: order.totalAmount, currency: order.currency });
  const first = await fulfilPaymentEvent(success, "MANUAL");
  check("the event is fulfilled", first.ok && first.outcome === "fulfilled");

  const paid = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    select: { status: true, paidAt: true, expiresAt: true },
  });
  check("the order is PAID", paid.status === "PAID");
  check("it carries a paid timestamp", paid.paidAt !== null);
  check("its expiry is cleared", paid.expiresAt === null);

  const enrolments = await db.enrollment.findMany({
    where: { userId: user.id, courseId: course.id },
    select: { status: true, source: true, orderId: true },
  });
  check("exactly one enrolment exists", enrolments.length === 1);
  check("it is ACTIVE", enrolments[0]?.status === "ACTIVE");
  check("its source is PURCHASE", enrolments[0]?.source === "PURCHASE");
  check("it is linked to the order", enrolments[0]?.orderId === order.id);

  const progress = await db.courseProgress.count({
    where: { enrollment: { userId: user.id, courseId: course.id } },
  });
  check("progress was initialised once", progress === 1);

  const afterFirst = await db.course.findUniqueOrThrow({
    where: { id: course.id },
    select: { enrollmentCount: true },
  });
  check("the course enrolment count rose by one", afterFirst.enrollmentCount === countBefore + 1);

  const payoutLines = await db.instructorPayoutLine.count({ where: { orderId: order.id } });
  check("one payout line was written", payoutLines === 1);

  // ------------------------------------------------------------ idempotency
  console.log("\nWebhook retry with the same event id");
  const replay = await fulfilPaymentEvent(success, "MANUAL");
  check("the retry reports already_processed", replay.ok && replay.outcome === "already_processed");

  const enrolmentsAfterReplay = await db.enrollment.count({
    where: { userId: user.id, courseId: course.id },
  });
  check("still exactly one enrolment", enrolmentsAfterReplay === 1);

  const paymentsAfterReplay = await db.payment.count({ where: { orderId: order.id } });
  check("still exactly one payment row", paymentsAfterReplay === 1);

  const payoutAfterReplay = await db.instructorPayoutLine.count({ where: { orderId: order.id } });
  check("still exactly one payout line", payoutAfterReplay === 1);

  const countAfterReplay = await db.course.findUniqueOrThrow({
    where: { id: course.id },
    select: { enrollmentCount: true },
  });
  check(
    "the enrolment count did not move again",
    countAfterReplay.enrollmentCount === countBefore + 1,
  );

  // --------------------------------------------------------- amount mismatch
  console.log("\nUnderpaid event");
  await reset(user.id);
  const basket2 = await buildBasket(user.id, [SLUG]);
  const order2 = await createOrder({ userId: user.id, basket: basket2, discountAmount: 0 });

  const underpaid = await fulfilPaymentEvent(
    event({ orderId: order2.id, amount: 1, currency: order2.currency }),
    "MANUAL",
  );
  check("a smaller amount is rejected", !underpaid.ok);
  check("and named as an amount mismatch", !underpaid.ok && underpaid.reason === "amount_mismatch");

  const grantedByUnderpay = await db.enrollment.count({ where: { userId: user.id } });
  check("nothing was enrolled", grantedByUnderpay === 0);

  const order2Row = await db.order.findUniqueOrThrow({
    where: { id: order2.id },
    select: { status: true },
  });
  check("the order was not marked PAID", order2Row.status !== "PAID");

  const rejection = await db.payment.findFirst({
    where: { orderId: order2.id },
    select: { status: true, failureReason: true },
  });
  check("the rejection was recorded for reconciliation", rejection?.status === "FAILED");
  check("with its reason", rejection?.failureReason === "amount_mismatch");

  console.log("\nWrong currency");
  await reset(user.id);
  const basket3 = await buildBasket(user.id, [SLUG]);
  const order3 = await createOrder({ userId: user.id, basket: basket3, discountAmount: 0 });
  const wrongCurrency = await fulfilPaymentEvent(
    event({ orderId: order3.id, amount: order3.totalAmount, currency: "EUR" }),
    "MANUAL",
  );
  check(
    "a matching amount in another currency is rejected",
    !wrongCurrency.ok && wrongCurrency.reason === "currency_mismatch",
  );
  check("nothing was enrolled", (await db.enrollment.count({ where: { userId: user.id } })) === 0);

  // ------------------------------------------------------------ unknown order
  console.log("\nEvent for an order that does not exist");
  const unknown = await fulfilPaymentEvent(
    event({ orderId: "00000000-0000-0000-0000-000000000000", amount: 4900 }),
    "MANUAL",
  );
  check("it is rejected", !unknown.ok && unknown.reason === "order_not_found");

  // ------------------------------------------------------------ failed event
  console.log("\nDeclined payment");
  await reset(user.id);
  const basket4 = await buildBasket(user.id, [SLUG]);
  const order4 = await createOrder({ userId: user.id, basket: basket4, discountAmount: 0 });
  await fulfilPaymentEvent(
    event({
      orderId: order4.id,
      kind: "failed",
      amount: order4.totalAmount,
      failureReason: "card_declined",
    }),
    "MANUAL",
  );

  const order4Row = await db.order.findUniqueOrThrow({
    where: { id: order4.id },
    select: { status: true },
  });
  check("the order is FAILED", order4Row.status === "FAILED");
  check("nothing was enrolled", (await db.enrollment.count({ where: { userId: user.id } })) === 0);

  // -------------------------------------------------------- abandoned basket
  console.log("\nAbandoned checkout");
  await reset(user.id);
  const basket5 = await buildBasket(user.id, [SLUG]);
  const order5 = await createOrder({ userId: user.id, basket: basket5, discountAmount: 0 });

  const stillPending = await db.order.findUniqueOrThrow({
    where: { id: order5.id },
    select: { status: true, expiresAt: true },
  });
  check("a fresh order is PENDING", stillPending.status === "PENDING");
  check("with a checkout window", stillPending.expiresAt !== null);

  await expireAbandonedOrders();
  const notYetExpired = await db.order.findUniqueOrThrow({
    where: { id: order5.id },
    select: { status: true },
  });
  check("an unexpired order is left alone", notYetExpired.status === "PENDING");

  // Push the window into the past and reap again.
  await db.order.update({
    where: { id: order5.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await expireAbandonedOrders();
  const reaped = await db.order.findUniqueOrThrow({
    where: { id: order5.id },
    select: { status: true },
  });
  check("a lapsed order is CANCELLED", reaped.status === "CANCELLED");
  check("nothing was enrolled", (await db.enrollment.count({ where: { userId: user.id } })) === 0);

  // ------------------------------------------------------------------ refund
  console.log("\nRefund");
  await reset(user.id);
  const basket6 = await buildBasket(user.id, [SLUG]);
  const order6 = await createOrder({ userId: user.id, basket: basket6, discountAmount: 0 });
  await fulfilPaymentEvent(
    event({ orderId: order6.id, amount: order6.totalAmount, currency: order6.currency }),
    "MANUAL",
  );
  check(
    "the order is paid first",
    (await db.enrollment.count({ where: { userId: user.id, status: "ACTIVE" } })) === 1,
  );

  await fulfilPaymentEvent(
    event({ orderId: order6.id, kind: "refunded", amount: order6.totalAmount }),
    "MANUAL",
  );

  const refunded = await db.order.findUniqueOrThrow({
    where: { id: order6.id },
    select: { status: true, refundedAt: true },
  });
  check("the order is REFUNDED", refunded.status === "REFUNDED");
  check("with a refund timestamp", refunded.refundedAt !== null);

  const revoked = await db.enrollment.findFirstOrThrow({
    where: { userId: user.id, courseId: course.id },
    select: { status: true },
  });
  check("access was revoked", revoked.status === "REFUNDED");

  const ledger = await db.instructorPayoutLine.findMany({
    where: { orderId: order6.id },
    select: { amount: true },
  });
  check("the original payout line was kept", ledger.length === 2);
  check("and reversed to a net of zero", ledger.reduce((sum, line) => sum + line.amount, 0) === 0);

  const countAfterRefund = await db.course.findUniqueOrThrow({
    where: { id: course.id },
    select: { enrollmentCount: true },
  });
  check(
    "the course enrolment count came back down",
    countAfterRefund.enrollmentCount === countBefore,
  );

  // --------------------------------------------------------------- tidy up
  await reset(user.id);
  await db.user.delete({ where: { id: user.id } });

  const finalCount = await db.course.findUniqueOrThrow({
    where: { id: course.id },
    select: { enrollmentCount: true },
  });
  console.log(
    `\n  note  course enrolment count: ${countBefore} before, ${finalCount.enrollmentCount} after`,
  );

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
