import type { Metadata } from "next";
import Link from "next/link";

import { routes } from "@/lib/routes";
import { formatDateTime, formatPrice } from "@/lib/format";
import { requireAdmin } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Grid, PageHeader, Stack } from "@/components/layout/primitives";
import { StatTile } from "@/components/admin/stat-tile";
import { DataTable, EmptyRow, Td, Th } from "@/components/admin/data-table";
import { AdminFilterChips, AdminPagination, AdminSearch } from "@/components/admin/admin-filters";
import {
  getRevenueByCourse,
  getRevenueSummary,
  listPayments,
  PAYMENT_PAGE_SIZE,
  type PaymentStatusFilter,
} from "@/features/admin/payments";

export const metadata: Metadata = { title: "Payments" };

const STATUSES: PaymentStatusFilter[] = ["SUCCEEDED", "FAILED", "PENDING", "REFUNDED"];

const statusTone = {
  SUCCEEDED: "success",
  FAILED: "danger",
  PENDING: "warning",
  REFUNDED: "neutral",
} as const;

/**
 * Payments and revenue.
 *
 * Failed attempts are listed alongside successful ones rather than hidden. A
 * console that shows only what worked cannot answer the question an admin
 * actually arrives with — "this customer says they were charged and got
 * nothing" — which is always a question about the attempts that failed.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin(routes.adminPayments);

  const page = Number.parseInt(params.page ?? "1", 10);
  const status = STATUSES.find((entry) => entry === params.status);

  const [result, revenue, topCourses] = await Promise.all([
    listPayments({ q: params.q, status, page: Number.isFinite(page) ? page : 1 }),
    getRevenueSummary(),
    getRevenueByCourse(6),
  ]);

  return (
    <Stack gap={6}>
      <PageHeader
        eyebrow="Admin"
        title="Payments"
        description="Every transaction the platform has seen, and what it added up to."
      />

      <Grid cols={4} gap={4}>
        <StatTile
          label="Net revenue"
          value={formatPrice(revenue.netRevenue, revenue.currency)}
          current={revenue.last30Days}
          previous={revenue.previous30Days}
        />
        <StatTile
          label="Gross revenue"
          value={formatPrice(revenue.grossRevenue, revenue.currency)}
          hint={`${revenue.paidOrders} paid order${revenue.paidOrders === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Average order"
          value={formatPrice(revenue.averageOrderValue, revenue.currency)}
          hint={`${formatPrice(revenue.discountGiven, revenue.currency)} discounted`}
        />
        <StatTile
          label="Payment success"
          value={`${revenue.successRate}%`}
          hint={`${revenue.failedOrders} failed · ${revenue.pendingOrders} pending`}
        />
      </Grid>

      {revenue.refunded > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">
              {formatPrice(revenue.refunded, revenue.currency)}
            </strong>{" "}
            refunded across <span data-numeric>{revenue.refundedOrders}</span> order
            {revenue.refundedOrders === 1 ? "" : "s"}, already deducted from net revenue.
          </p>
        </Card>
      ) : null}

      {/* --- what sells ----------------------------------------------------- */}
      {topCourses.length > 0 ? (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold">Revenue by course</h2>
          <ul className="flex flex-col gap-2.5">
            {topCourses.map((course) => {
              const share =
                revenue.grossRevenue === 0
                  ? 0
                  : Math.round((course.revenue / revenue.grossRevenue) * 100);

              return (
                <li key={course.courseId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">
                      {course.slug ? (
                        <Link href={routes.course(course.slug)} className="hover:text-primary">
                          {course.title}
                        </Link>
                      ) : (
                        course.title
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      <span data-numeric>{course.unitsSold}</span> ·{" "}
                      <span className="font-medium text-foreground" data-numeric>
                        {formatPrice(course.revenue, revenue.currency)}
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-secondary"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* --- transactions --------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <AdminSearch
          label="Search transactions"
          placeholder="Order number, customer or payment id"
        />
        <AdminFilterChips
          param="status"
          allLabel="All"
          allCount={result.counts.all}
          options={STATUSES.map((entry) => ({
            value: entry,
            label: entry.toLowerCase(),
            count: result.counts[entry],
          }))}
        />
      </div>

      <DataTable
        caption="Payment transactions"
        head={
          <>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th>Provider</Th>
            <Th align="right">Amount</Th>
            <Th>When</Th>
          </>
        }
      >
        {result.rows.length === 0 ? (
          <EmptyRow colSpan={6}>No transactions match those filters.</EmptyRow>
        ) : (
          result.rows.map((payment) => (
            <tr key={payment.id} className="transition-colors hover:bg-muted/40">
              <Td>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <code className="font-mono text-sm font-medium">{payment.orderNumber}</code>
                  <span className="truncate text-xs text-muted-foreground">
                    {payment.itemTitles.join(" · ") || "No items"}
                  </span>
                </div>
              </Td>

              <Td>
                <Link
                  href={routes.adminUser(payment.customerId)}
                  className="flex min-w-0 flex-col hover:text-primary"
                >
                  <span className="truncate">{payment.customerName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {payment.customerEmail}
                  </span>
                </Link>
              </Td>

              <Td>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={statusTone[payment.status]} size="sm">
                    {payment.status.toLowerCase()}
                  </Badge>
                  {payment.failureReason ? (
                    <span className="text-2xs text-danger">{payment.failureReason}</span>
                  ) : null}
                </div>
              </Td>

              <Td>
                <span className="text-muted-foreground">{payment.provider.toLowerCase()}</span>
              </Td>

              <Td align="right">
                <span className="font-medium" data-numeric>
                  {formatPrice(payment.amount, payment.currency)}
                </span>
              </Td>

              <Td>
                <span className="text-muted-foreground">{formatDateTime(payment.createdAt)}</span>
              </Td>
            </tr>
          ))
        )}
      </DataTable>

      <AdminPagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={PAYMENT_PAGE_SIZE}
      />
    </Stack>
  );
}
