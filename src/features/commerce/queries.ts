import "server-only";

import { db } from "@/server/db";

/** Transaction history. */
export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  placedAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  couponCode: string | null;
  items: Array<{
    courseId: string;
    courseSlug: string | null;
    title: string;
    unitAmount: number;
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    amount: number;
    failureReason: string | null;
    createdAt: string;
  }>;
}

function toSummary(row: {
  id: string;
  orderNumber: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  placedAt: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
  coupon: { code: string } | null;
  items: Array<{
    courseId: string;
    titleSnapshot: string;
    unitAmount: number;
    course: { slug: string; status: string; deletedAt: Date | null };
  }>;
  payments: Array<{
    id: string;
    provider: string;
    status: string;
    amount: number;
    failureReason: string | null;
    createdAt: Date;
  }>;
}): OrderSummary {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status as OrderSummary["status"],
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    totalAmount: row.totalAmount,
    currency: row.currency,
    placedAt: row.placedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    couponCode: row.coupon?.code ?? null,
    items: row.items.map((item) => ({
      courseId: item.courseId,
      // The snapshot titles the receipt; the live slug only links when the
      // course is still there to link to.
      courseSlug:
        item.course.deletedAt === null && item.course.status === "PUBLISHED"
          ? item.course.slug
          : null,
      title: item.titleSnapshot,
      unitAmount: item.unitAmount,
    })),
    payments: row.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  subtotalAmount: true,
  discountAmount: true,
  totalAmount: true,
  currency: true,
  placedAt: true,
  paidAt: true,
  refundedAt: true,
  coupon: { select: { code: true } },
  items: {
    select: {
      courseId: true,
      titleSnapshot: true,
      unitAmount: true,
      course: { select: { slug: true, status: true, deletedAt: true } },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      status: true,
      amount: true,
      failureReason: true,
      createdAt: true,
    },
  },
} as const;

export async function getOrders(userId: string): Promise<OrderSummary[]> {
  const rows = await db.order.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    take: 100,
    select: orderSelect,
  });
  return rows.map(toSummary);
}

/** One order, scoped to its owner — an order number is not a capability. */
export async function getOrderByNumber(
  userId: string,
  orderNumber: string,
): Promise<OrderSummary | null> {
  const row = await db.order.findFirst({
    where: { orderNumber: orderNumber.trim().toUpperCase(), userId },
    select: orderSelect,
  });
  return row ? toSummary(row) : null;
}
