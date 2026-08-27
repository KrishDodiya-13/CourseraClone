import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/authz";
import { Button } from "@/components/ui/button";
import { Stack } from "@/components/layout/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/states/empty-state";
import { CourseProgressCard } from "@/components/dashboard/course-progress-card";
import { SectionHeading } from "@/components/dashboard/stat-tile";
import { getEnrolledCourses } from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "My courses" };

export default async function DashboardCoursesPage() {
  const user = await requireAuth(routes.dashboardCourses);
  const courses = await getEnrolledCourses(user.id);

  const active = courses.filter((course) => course.status === "ACTIVE" && course.percent < 100);
  const completed = courses.filter(
    (course) => course.status === "COMPLETED" || course.percent >= 100,
  );

  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen aria-hidden="true" />}
        title="You are not enrolled in anything"
        description="Courses you enrol in appear here, with your progress on each."
        size="lg"
        actions={
          <Button asChild>
            <Link href={routes.courses}>Browse the catalogue</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Stack gap={6}>
      <SectionHeading title="My courses">
        <p className="text-sm text-muted-foreground" data-numeric>
          {courses.length} enrolled · {completed.length} finished
        </p>
      </SectionHeading>

      <Tabs defaultValue="active">
        <TabsList variant="underline">
          <TabsTrigger value="active">In progress ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="all">All ({courses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {active.length === 0 ? (
            <EmptyState
              title="Nothing in progress"
              description="Everything you have started is finished. Time for something new."
              actions={
                <Button asChild>
                  <Link href={routes.courses}>Find a course</Link>
                </Button>
              }
            />
          ) : (
            <Stack gap={4}>
              {active.map((course) => (
                <CourseProgressCard key={course.enrollmentId} course={course} />
              ))}
            </Stack>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completed.length === 0 ? (
            <EmptyState
              title="Nothing completed yet"
              description="Finish every required lesson in a course and it moves here."
            />
          ) : (
            <Stack gap={4}>
              {completed.map((course) => (
                <CourseProgressCard key={course.enrollmentId} course={course} />
              ))}
            </Stack>
          )}
        </TabsContent>

        <TabsContent value="all">
          <Stack gap={4}>
            {courses.map((course) => (
              <CourseProgressCard key={course.enrollmentId} course={course} />
            ))}
          </Stack>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
