import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { DEFAULT_CURRENCY } from "@/lib/currency";

/**
 * Payment and revenue reporting.
 *
 * Two rules carried forward from the commerce phase.
 *
 * **Revenue is read from orders, not from payment attempts.** A single order
 * can carry several payment rows — a decline, a retry, a success — and summing
 * those would count a stubborn customer as a rich one. Money is `Order.status
 * = PAID`, minus refunds.
 *
 * **Every amount stays an integer of minor units** until the moment it is
 * formatted, so no rounding creeps into a figure someone reconciles against a
 * provider statement.
 */

export const PAYMENT_PAGE_SIZE = 25;

export type PaymentStatusFilter = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export interface AdminPaymentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: string;
  status: PaymentStatusFilter;
  amount: number;
  currency: string;
  failureReason: string | null;
  providerPaymentId: string;
  customerName: string;
  customerEmail: string;
  customerId: string;
  itemTitles: string[];
  createdAt: string;
}

export interface AdminPaymentQuery {
  q?: string;
  status?: PaymentStatusFilter;
  page?: number;
}

export interface RevenueSummary {
  currency: string;
  /** Sum of PAID order totals, all time. */
  grossRevenue: number;
  /** Sum of REFUNDED order totals, all time. */
  refunded: number;
  /** Gross minus refunds — what the business actually kept. */
  netRevenue: number;
  paidOrders: number;
  refundedOrders: number;
  failedOrders: number;
  pendingOrders: number;
  averageOrderValue: number;
  /** Successful payments as a share of resolved attempts, 0-100. */
  successRate: number;
  discountGiven: number;
  last30Days: number;
  previous30Days: number;
}

export interface AdminPaymentPage {
  rows: AdminPaymentRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: Record<PaymentStatusFilter | "all", number>;
}

export async function listPayments(query: AdminPaymentQuery): Promise<AdminPaymentPage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));

  const where: Prisma.PaymentWhereInput = {};
  const term = query.q?.trim();
  if (term) {
    where.OR = [
      { order: { orderNumber: { contains: term, mode: "insensitive" } } },
      { order: { user: { email: { contains: term, mode: "insensitive" } } } },
      { order: { user: { name: { contains: term, mode: "insensitive" } } } },
      { providerPaymentId: { contains: term, mode: "insensitive" } },
    ];
  }
  if (query.status) where.status = query.status;

  const statuses: PaymentStatusFilter[] = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"];

  const [total, rows, all, ...byStatus] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAYMENT_PAGE_SIZE,
      take: PAYMENT_PAGE_SIZE,
      select: {
        id: true,
        orderId: true,
        provider: true,
        status: true,
        amount: true,
        currency: true,
        failureReason: true,
        providerPaymentId: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            user: { select: { id: true, name: true, email: true } },
            items: { select: { titleSnapshot: true } },
          },
        },
      },
    }),
    db.payment.count(),
    ...statuses.map((status) => db.payment.count({ where: { status } })),
  ]);

  const counts = { all } as AdminPaymentPage["counts"];
  statuses.forEach((status, index) => {
    counts[status] = byStatus[index] ?? 0;
  });

  return {
    rows: rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      provider: row.provider,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      failureReason: row.failureReason,
      providerPaymentId: row.providerPaymentId,
      customerName: row.order.user.name,
      customerEmail: row.order.user.email,
      customerId: row.order.user.id,
      itemTitles: row.order.items.map((item) => item.titleSnapshot),
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAYMENT_PAGE_SIZE)),
    counts,
  };
}

export async function getRevenueSummary(): Promise<RevenueSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    paid,
    refunded,
    failedOrders,
    pendingOrders,
    succeededPayments,
    failedPayments,
    recent,
    prior,
  ] = await Promise.all([
    db.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmount: true, discountAmount: true },
      _count: true,
    }),
    db.order.aggregate({
      where: { status: "REFUNDED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.order.count({ where: { status: "FAILED" } }),
    db.order.count({ where: { status: "PENDING" } }),
    db.payment.count({ where: { status: "SUCCEEDED" } }),
    db.payment.count({ where: { status: "FAILED" } }),
    db.order.aggregate({
      where: { status: "PAID", paidAt: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true },
    }),
    db.order.aggregate({
      where: { status: "PAID", paidAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      _sum: { totalAmount: true },
    }),
  ]);

  const grossRevenue = paid._sum.totalAmount ?? 0;
  const refundedTotal = refunded._sum.totalAmount ?? 0;
  const resolvedAttempts = succeededPayments + failedPayments;

  return {
    currency: DEFAULT_CURRENCY,
    grossRevenue,
    refunded: refundedTotal,
    netRevenue: grossRevenue - refundedTotal,
    paidOrders: paid._count,
    refundedOrders: refunded._count,
    failedOrders,
    pendingOrders,
    averageOrderValue: paid._count === 0 ? 0 : Math.round(grossRevenue / paid._count),
    successRate:
      resolvedAttempts === 0 ? 0 : Math.round((succeededPayments / resolvedAttempts) * 100),
    discountGiven: paid._sum.discountAmount ?? 0,
    last30Days: recent._sum.totalAmount ?? 0,
    previous30Days: prior._sum.totalAmount ?? 0,
  };
}

export interface RevenueByCourse {
  courseId: string;
  title: string;
  slug: string;
  unitsSold: number;
  revenue: number;
}

/** Top sellers, by money rather than by enrolment count. */
export async function getRevenueByCourse(limit = 8): Promise<RevenueByCourse[]> {
  const grouped = await db.orderItem.groupBy({
    by: ["courseId"],
    where: { order: { status: "PAID" } },
    _sum: { unitAmount: true },
    _count: { _all: true },
    orderBy: { _sum: { unitAmount: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const courses = await db.course.findMany({
    where: { id: { in: grouped.map((entry) => entry.courseId) } },
    select: { id: true, title: true, slug: true },
  });
  const byId = new Map(courses.map((course) => [course.id, course]));

  return grouped.map((entry) => ({
    courseId: entry.courseId,
    title: byId.get(entry.courseId)?.title ?? "Removed course",
    slug: byId.get(entry.courseId)?.slug ?? "",
    unitsSold: entry._count._all,
    revenue: entry._sum.unitAmount ?? 0,
  }));
}
