import type { Metadata } from "next";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { formatDate, formatPrice, formatShortDate } from "@/lib/format";
import { requireAdmin } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { PageHeader, Stack } from "@/components/layout/primitives";
import { DataTable, EmptyRow, Td, Th } from "@/components/admin/data-table";
import { AdminFilterChips, AdminPagination, AdminSearch } from "@/components/admin/admin-filters";
import { UserActions } from "@/app/admin/users/user-actions";
import {
  getUserDetail,
  listUsers,
  USER_PAGE_SIZE,
  type UserRoleFilter,
  type UserStatusFilter,
} from "@/features/admin/users";

export const metadata: Metadata = { title: "Users" };

const ROLES: UserRoleFilter[] = ["STUDENT", "INSTRUCTOR", "ADMIN"];
const STATUSES: UserStatusFilter[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

/** Narrows a query-string value to a known enum member, ignoring anything else. */
function pick<T extends string>(value: string | undefined, allowed: T[]): T | undefined {
  return allowed.find((entry) => entry === value);
}

const roleTone = {
  ADMIN: "danger",
  INSTRUCTOR: "primary",
  STUDENT: "neutral",
} as const;

const statusTone = {
  ACTIVE: "success",
  SUSPENDED: "danger",
  DEACTIVATED: "neutral",
} as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
    user?: string;
  }>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin(routes.adminUsers);

  const page = Number.parseInt(params.page ?? "1", 10);

  const [result, detail] = await Promise.all([
    listUsers({
      q: params.q,
      role: pick(params.role, ROLES),
      status: pick(params.status, STATUSES),
      page: Number.isFinite(page) ? page : 1,
    }),
    params.user ? getUserDetail(params.user) : Promise.resolve(null),
  ]);

  return (
    <Stack gap={6}>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Search the directory, change roles, and suspend or reinstate accounts."
      />

      {/* --- the inspected account ----------------------------------------- */}
      {detail ? (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start gap-4">
            <UserAvatar name={detail.name} src={detail.avatarUrl} size="lg" />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{detail.name}</h2>
                <Badge variant={roleTone[detail.role]} size="sm">
                  {detail.role.toLowerCase()}
                </Badge>
                <Badge variant={statusTone[detail.status]} size="sm">
                  {detail.status.toLowerCase()}
                </Badge>
                {detail.emailVerified ? null : (
                  <Badge variant="warning" size="sm">
                    unverified
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{detail.email}</p>
              {detail.headline ? <p className="text-sm">{detail.headline}</p> : null}
              <p className="text-2xs text-muted-foreground">
                Joined {formatDate(detail.createdAt)} · {detail.timezone} · {detail.locale}
              </p>
            </div>

            <UserActions
              user={{
                id: detail.id,
                name: detail.name,
                email: detail.email,
                role: detail.role,
                status: detail.status,
                emailVerified: detail.emailVerified,
                avatarUrl: detail.avatarUrl,
                createdAt: detail.createdAt,
                deletedAt: detail.deletedAt,
                enrollmentCount: detail.enrollmentCount,
                taughtCourseCount: detail.taughtCourseCount,
              }}
              isSelf={detail.id === admin.id}
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-5">
            <Fact label="Enrolments" value={detail.enrollmentCount.toLocaleString()} />
            <Fact label="Completed" value={detail.completedCount.toLocaleString()} />
            <Fact label="Certificates" value={detail.certificateCount.toLocaleString()} />
            <Fact label="Paid orders" value={detail.orderCount.toLocaleString()} />
            <Fact label="Lifetime spend" value={formatPrice(detail.paidTotal, detail.currency)} />
          </dl>

          {detail.recentEnrollments.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Recent enrolments</h3>
              <ul className="flex flex-col gap-1.5">
                {detail.recentEnrollments.map((enrollment) => (
                  <li
                    key={enrollment.courseSlug}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="truncate">{enrollment.courseTitle}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {enrollment.status.toLowerCase()} ·{" "}
                      <span data-numeric>{enrollment.percent}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* --- filters -------------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        <AdminSearch label="Search users" placeholder="Search by name or email" />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <AdminFilterChips
            param="role"
            allLabel="All roles"
            allCount={result.counts.all}
            options={[
              { value: "STUDENT", label: "Students", count: result.counts.students },
              { value: "INSTRUCTOR", label: "Instructors", count: result.counts.instructors },
              { value: "ADMIN", label: "Admins", count: result.counts.admins },
            ]}
          />
          <AdminFilterChips
            param="status"
            allLabel="Any status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "SUSPENDED", label: "Suspended", count: result.counts.suspended },
              { value: "DEACTIVATED", label: "Deactivated" },
            ]}
          />
        </div>
      </div>

      {/* --- directory ------------------------------------------------------ */}
      <DataTable
        caption="Platform users"
        head={
          <>
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Status</Th>
            <Th align="right">Enrolments</Th>
            <Th align="right">Teaching</Th>
            <Th>Joined</Th>
            <Th align="right">
              <span className="sr-only">Actions</span>
            </Th>
          </>
        }
      >
        {result.rows.length === 0 ? (
          <EmptyRow colSpan={7}>No users match those filters.</EmptyRow>
        ) : (
          result.rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "transition-colors hover:bg-muted/40",
                row.id === params.user && "bg-primary-subtle/40",
              )}
            >
              <Td>
                <a
                  href={routes.adminUser(row.id)}
                  className="flex items-center gap-3 hover:text-primary"
                >
                  <UserAvatar name={row.name} src={row.avatarUrl} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{row.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{row.email}</span>
                  </span>
                </a>
              </Td>
              <Td>
                <Badge variant={roleTone[row.role]} size="sm">
                  {row.role.toLowerCase()}
                </Badge>
              </Td>
              <Td>
                <Badge variant={statusTone[row.status]} size="sm">
                  {row.status.toLowerCase()}
                </Badge>
              </Td>
              <Td align="right">
                <span data-numeric>{row.enrollmentCount}</span>
              </Td>
              <Td align="right">
                <span data-numeric>{row.taughtCourseCount}</span>
              </Td>
              <Td>
                <span className="text-muted-foreground">{formatShortDate(row.createdAt)}</span>
              </Td>
              <Td align="right">
                <UserActions user={row} isSelf={row.id === admin.id} />
              </Td>
            </tr>
          ))
        )}
      </DataTable>

      <AdminPagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={USER_PAGE_SIZE}
      />
    </Stack>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="font-medium" data-numeric>
        {value}
      </dd>
    </div>
  );
}
