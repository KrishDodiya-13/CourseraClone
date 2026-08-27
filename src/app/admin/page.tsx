import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, TriangleAlert } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { requireAdmin } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Grid, PageHeader, Stack } from "@/components/layout/primitives";
import { StatTile } from "@/components/admin/stat-tile";
import { AuditFeed } from "@/components/admin/audit-feed";
import { getPlatformMetrics } from "@/features/admin/analytics";
import { getRevenueSummary } from "@/features/admin/payments";
import { getAuditLog } from "@/features/admin/audit";

export const metadata: Metadata = { title: "Overview" };

/**
 * Console overview.
 *
 * Ordered by what needs a decision rather than by what is impressive: the
 * moderation queue and suspended accounts come before the revenue figure,
 * because the first two are work and the third is a result.
 */
export default async function AdminPage() {
  const admin = await requireAdmin(routes.admin);

  const [metrics, revenue, audit] = await Promise.all([
    getPlatformMetrics(),
    getRevenueSummary(),
    getAuditLog(12),
  ]);

  const needsReview = metrics.courses.inReview;

  return (
    <Stack gap={6}>
      <PageHeader
        eyebrow="Admin console"
        title={`Good to see you, ${admin.name.split(" ")[0]}`}
        description="Everything on this page reads live from the database. Nothing here is cached between requests."
        actions={<Badge variant="danger">admin</Badge>}
      />

      {/* --- what needs attention ------------------------------------------ */}
      {needsReview > 0 || metrics.users.suspended > 0 ? (
        <Card className="flex flex-col gap-3 border-warning/40 p-4 sm:flex-row sm:items-center">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <p className="flex-1 text-sm">
            {needsReview > 0 ? (
              <>
                <strong data-numeric>{needsReview}</strong> course
                {needsReview === 1 ? "" : "s"} waiting for review.
              </>
            ) : null}
            {needsReview > 0 && metrics.users.suspended > 0 ? " " : null}
            {metrics.users.suspended > 0 ? (
              <>
                <strong data-numeric>{metrics.users.suspended}</strong> suspended account
                {metrics.users.suspended === 1 ? "" : "s"}.
              </>
            ) : null}
          </p>
          {needsReview > 0 ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={`${routes.adminCourses}?status=IN_REVIEW`}>
                Open the queue
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </Card>
      ) : null}

      {/* --- headline figures ---------------------------------------------- */}
      <Grid cols={4} gap={4}>
        <StatTile
          label="Users"
          value={metrics.users.total.toLocaleString()}
          current={metrics.users.newLast30Days}
          previous={metrics.users.newPrevious30Days}
        />
        <StatTile
          label="Published courses"
          value={metrics.courses.published.toLocaleString()}
          hint={`${metrics.courses.total} in total`}
        />
        <StatTile
          label="Enrolments"
          value={metrics.learning.enrollments.toLocaleString()}
          hint={`${metrics.learning.completionRate}% completed`}
        />
        <StatTile
          label="Net revenue"
          value={formatPrice(revenue.netRevenue, revenue.currency)}
          current={revenue.last30Days}
          previous={revenue.previous30Days}
        />
      </Grid>

      <Grid cols={2} gap={4}>
        {/* --- audit trail ------------------------------------------------- */}
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
              Recent administrative actions
            </h2>
            <Badge variant="neutral" size="sm">
              audit log
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Every privileged change is recorded here with its actor, in the same transaction as the
            change itself.
          </p>
          <AuditFeed entries={audit} />
        </Card>

        {/* --- composition -------------------------------------------------- */}
        <Stack gap={4}>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-sm font-semibold">Who is here</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Students" value={metrics.users.students} />
              <Row label="Instructors" value={metrics.users.instructors} />
              <Row label="Admins" value={metrics.users.admins} />
              <Row label="Verified email" value={metrics.users.verified} />
              <Row label="Suspended" value={metrics.users.suspended} />
            </dl>
            <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link href={routes.adminUsers}>Manage users</Link>
            </Button>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-sm font-semibold">Catalogue</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Published" value={metrics.courses.published} />
              <Row label="In review" value={metrics.courses.inReview} />
              <Row label="Draft" value={metrics.courses.draft} />
              <Row label="Rejected" value={metrics.courses.rejected} />
              <Row label="Archived" value={metrics.courses.archived} />
            </dl>
            <Button variant="outline" size="sm" className="w-fit" asChild>
              <Link href={routes.adminCourses}>Moderate courses</Link>
            </Button>
          </Card>
        </Stack>
      </Grid>
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" data-numeric>
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
