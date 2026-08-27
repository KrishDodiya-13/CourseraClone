import type { Metadata } from "next";

import { routes } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { requireAdmin } from "@/server/authz";
import { Card } from "@/components/ui/card";
import { Grid, PageHeader, Stack } from "@/components/layout/primitives";
import { StatTile } from "@/components/admin/stat-tile";
import { TrendChart } from "@/components/admin/trend-chart";
import { DataTable, EmptyRow, Td, Th } from "@/components/admin/data-table";
import { AuditFeed } from "@/components/admin/audit-feed";
import {
  getCategoryPerformance,
  getDailySeries,
  getPlatformMetrics,
} from "@/features/admin/analytics";
import { getRevenueSummary } from "@/features/admin/payments";
import { getAuditLog } from "@/features/admin/audit";

export const metadata: Metadata = { title: "Reports" };

/**
 * Platform reporting.
 *
 * Each figure is computed from the table that owns it rather than read from a
 * denormalised counter, so this page is also the place a drift between the two
 * would show up.
 */
export default async function AdminReportsPage() {
  await requireAdmin(routes.adminReports);

  const [metrics, revenue, series, categories, audit] = await Promise.all([
    getPlatformMetrics(),
    getRevenueSummary(),
    getDailySeries(30),
    getCategoryPerformance(),
    getAuditLog(20),
  ]);

  return (
    <Stack gap={6}>
      <PageHeader
        eyebrow="Admin"
        title="Reports"
        description="Growth, catalogue health and learning outcomes across the platform."
      />

      {/* --- people --------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">People</h2>
        <Grid cols={4} gap={4}>
          <StatTile
            label="Total users"
            value={metrics.users.total.toLocaleString()}
            current={metrics.users.newLast30Days}
            previous={metrics.users.newPrevious30Days}
          />
          <StatTile
            label="Students"
            value={metrics.users.students.toLocaleString()}
            hint={`${metrics.learning.learnersActiveLast7Days} active in 7 days`}
          />
          <StatTile
            label="Instructors"
            value={metrics.users.instructors.toLocaleString()}
            hint={`${metrics.users.admins} admin${metrics.users.admins === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Suspended"
            value={metrics.users.suspended.toLocaleString()}
            hint={`${metrics.users.verified} verified email`}
          />
        </Grid>
      </section>

      {/* --- catalogue ------------------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Catalogue</h2>
        <Grid cols={4} gap={4}>
          <StatTile
            label="Published courses"
            value={metrics.courses.published.toLocaleString()}
            hint={`${metrics.courses.total} total · ${metrics.courses.inReview} in review`}
          />
          <StatTile
            label="Lessons"
            value={metrics.courses.totalLessons.toLocaleString()}
            hint={`${metrics.courses.free} free · ${metrics.courses.paid} paid`}
          />
          <StatTile
            label="Average rating"
            value={metrics.courses.averageRating.toFixed(2)}
            hint="Across rated courses only"
          />
          <StatTile
            label="Certificates"
            value={metrics.learning.certificatesIssued.toLocaleString()}
            hint="Issued on completion"
          />
        </Grid>
      </section>

      {/* --- learning ------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Learning</h2>
        <Grid cols={4} gap={4}>
          <StatTile
            label="Enrolments"
            value={metrics.learning.enrollments.toLocaleString()}
            hint={`${metrics.learning.activeEnrollments} active`}
          />
          <StatTile
            label="Completed"
            value={metrics.learning.completedEnrollments.toLocaleString()}
            hint="Reached 100% of required lessons"
          />
          <StatTile
            label="Completion rate"
            value={`${metrics.learning.completionRate}%`}
            hint="Completed ÷ active + completed"
          />
          <StatTile
            label="Average progress"
            value={`${metrics.learning.averageProgress}%`}
            hint="Across live enrolments"
          />
        </Grid>
      </section>

      {/* --- revenue -------------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Revenue</h2>
        <Grid cols={4} gap={4}>
          <StatTile
            label="Net revenue"
            value={formatPrice(revenue.netRevenue, revenue.currency)}
            current={revenue.last30Days}
            previous={revenue.previous30Days}
          />
          <StatTile
            label="Gross"
            value={formatPrice(revenue.grossRevenue, revenue.currency)}
            hint={`${revenue.paidOrders} paid orders`}
          />
          <StatTile
            label="Refunded"
            value={formatPrice(revenue.refunded, revenue.currency)}
            hint={`${revenue.refundedOrders} order${revenue.refundedOrders === 1 ? "" : "s"}`}
            invertTrend
          />
          <StatTile
            label="Average order"
            value={formatPrice(revenue.averageOrderValue, revenue.currency)}
            hint={`${revenue.successRate}% of attempts succeed`}
          />
        </Grid>
      </section>

      {/* --- trend ---------------------------------------------------------- */}
      <Grid cols={2} gap={4}>
        <Card className="p-5">
          <TrendChart points={series} series="users" label="New accounts" />
        </Card>
        <Card className="p-5">
          <TrendChart points={series} series="enrollments" label="New enrolments" />
        </Card>
      </Grid>

      {/* --- by category ----------------------------------------------------- */}
      <Stack gap={3}>
        <h2 className="text-sm font-semibold">By category</h2>
        <DataTable
          caption="Category performance"
          head={
            <>
              <Th>Category</Th>
              <Th align="right">Published courses</Th>
              <Th align="right">Enrolments</Th>
              <Th align="right">Completion rate</Th>
            </>
          }
        >
          {categories.length === 0 ? (
            <EmptyRow colSpan={4}>No categories yet.</EmptyRow>
          ) : (
            categories.map((category) => (
              <tr key={category.id} className="transition-colors hover:bg-muted/40">
                <Td>{category.name}</Td>
                <Td align="right">
                  <span data-numeric>{category.courses}</span>
                </Td>
                <Td align="right">
                  <span data-numeric>{category.enrollments}</span>
                </Td>
                <Td align="right">
                  <span data-numeric>{category.completionRate}%</span>
                </Td>
              </tr>
            ))
          )}
        </DataTable>
      </Stack>

      {/* --- audit ----------------------------------------------------------- */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold">Administrative activity</h2>
        <p className="text-sm text-muted-foreground">
          The full trail of privileged changes, with the account that made each one.
        </p>
        <AuditFeed entries={audit} />
      </Card>
    </Stack>
  );
}
