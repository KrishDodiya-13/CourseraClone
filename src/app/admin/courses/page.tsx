import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatCoursePrice, formatDuration } from "@/lib/format";
import { requireAdmin } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader, Stack } from "@/components/layout/primitives";
import { DataTable, EmptyRow, Td, Th } from "@/components/admin/data-table";
import { AdminFilterChips, AdminPagination, AdminSearch } from "@/components/admin/admin-filters";
import { CourseActions } from "@/app/admin/courses/course-actions";
import { COURSE_PAGE_SIZE, listCourses, type CourseStatusFilter } from "@/features/admin/courses";

export const metadata: Metadata = { title: "Courses" };

const STATUSES: CourseStatusFilter[] = ["DRAFT", "IN_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"];

const statusTone = {
  DRAFT: "neutral",
  IN_REVIEW: "warning",
  PUBLISHED: "success",
  REJECTED: "danger",
  ARCHIVED: "neutral",
} as const;

/**
 * Course moderation.
 *
 * The list shows unpublished work on purpose — that is the whole job. Each row
 * carries the metadata review next to the publish control, so the decision and
 * the evidence for it are in the same place.
 */
export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin(routes.adminCourses);

  const page = Number.parseInt(params.page ?? "1", 10);
  const status = STATUSES.find((entry) => entry === params.status);

  const result = await listCourses({
    q: params.q,
    status,
    page: Number.isFinite(page) ? page : 1,
  });

  return (
    <Stack gap={6}>
      <PageHeader
        eyebrow="Admin"
        title="Course moderation"
        description="Review submissions, check metadata, and control what the catalogue shows."
      />

      {result.counts.IN_REVIEW > 0 && !status ? (
        <Card className="flex items-center gap-3 border-warning/40 p-4">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-sm">
            <strong data-numeric>{result.counts.IN_REVIEW}</strong> course
            {result.counts.IN_REVIEW === 1 ? " is" : "s are"} waiting for a decision.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        <AdminSearch label="Search courses" placeholder="Search by title or slug" />
        <AdminFilterChips
          param="status"
          allLabel="All"
          allCount={result.counts.all}
          options={STATUSES.map((entry) => ({
            value: entry,
            label: entry.toLowerCase().replace("_", " "),
            count: result.counts[entry],
          }))}
        />
      </div>

      <DataTable
        caption="Courses awaiting moderation"
        head={
          <>
            <Th>Course</Th>
            <Th>Status</Th>
            <Th>Instructor</Th>
            <Th align="right">Price</Th>
            <Th align="right">Lessons</Th>
            <Th align="right">Enrolled</Th>
            <Th>Review</Th>
            <Th align="right">
              <span className="sr-only">Actions</span>
            </Th>
          </>
        }
      >
        {result.rows.length === 0 ? (
          <EmptyRow colSpan={8}>No courses match those filters.</EmptyRow>
        ) : (
          result.rows.map((course) => (
            <tr key={course.id} className="transition-colors hover:bg-muted/40">
              <Td>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={routes.course(course.slug)}
                    className="inline-flex items-center gap-1.5 font-medium hover:text-primary"
                  >
                    <span className="truncate">{course.title}</span>
                    <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">
                    {course.categoryName} · {course.level.toLowerCase().replace("_", " ")} ·{" "}
                    {formatDuration(course.durationMinutes)}
                  </span>
                  {course.rejectionReason ? (
                    <span className="text-xs text-danger">Rejected: {course.rejectionReason}</span>
                  ) : null}
                </div>
              </Td>

              <Td>
                <Badge variant={statusTone[course.status]} size="sm">
                  {course.status.toLowerCase().replace("_", " ")}
                </Badge>
              </Td>

              <Td>
                {course.instructorId ? (
                  <Link href={routes.adminUser(course.instructorId)} className="hover:text-primary">
                    {course.instructorName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{course.instructorName}</span>
                )}
              </Td>

              <Td align="right">
                <span data-numeric>{formatCoursePrice(course.priceAmount, course.currency)}</span>
              </Td>

              <Td align="right">
                <span data-numeric>{course.lessonCount}</span>
              </Td>

              <Td align="right">
                <span data-numeric>{course.enrollmentCount}</span>
              </Td>

              <Td>
                {course.readiness.length === 0 ? (
                  <span className="text-xs text-success">Complete</span>
                ) : (
                  <span
                    className="text-xs text-warning-foreground"
                    title={course.readiness.join(", ")}
                  >
                    {course.readiness.length} gap
                    {course.readiness.length === 1 ? "" : "s"}
                  </span>
                )}
              </Td>

              <Td align="right">
                <CourseActions course={course} />
              </Td>
            </tr>
          ))
        )}
      </DataTable>

      <AdminPagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        pageSize={COURSE_PAGE_SIZE}
      />
    </Stack>
  );
}
