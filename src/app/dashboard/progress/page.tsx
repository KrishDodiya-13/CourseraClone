import type { Metadata } from "next";
import Link from "next/link";
import { Flame, PlayCircle, TrendingUp } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatDuration } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Grid, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { StatTile, ProgressBar, SectionHeading } from "@/components/dashboard/stat-tile";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import {
  getActivityCalendar,
  getEnrolledCourses,
  getLearningStats,
  getRecentActivity,
} from "@/features/dashboard/queries";

export const metadata: Metadata = { title: "Progress" };

export default async function DashboardProgressPage() {
  const user = await requireAuth(routes.dashboardProgress);

  const [stats, courses, calendar, activity] = await Promise.all([
    getLearningStats(user.id),
    getEnrolledCourses(user.id),
    getActivityCalendar(user.id),
    getRecentActivity(user.id, 12),
  ]);

  const overall =
    courses.length === 0
      ? 0
      : Math.round(courses.reduce((sum, course) => sum + course.percent, 0) / courses.length);

  return (
    <Stack gap={8}>
      <SectionHeading title="Progress">
        <p className="text-sm text-muted-foreground">
          Everything below is computed from your own completed lessons.
        </p>
      </SectionHeading>

      <Grid cols={4} gap={4}>
        <StatTile
          label="Average completion"
          value={`${overall}%`}
          icon={TrendingUp}
          tone="primary"
        />
        <StatTile label="Lessons completed" value={stats.lessonsCompleted} icon={PlayCircle} />
        <StatTile
          label="Time learning"
          value={stats.minutesLearned > 0 ? formatDuration(stats.minutesLearned) : "—"}
          hint={stats.activeDays > 0 ? `across ${stats.activeDays} days` : undefined}
        />
        <StatTile
          label="Longest streak"
          value={stats.longestStreak === 0 ? "—" : `${stats.longestStreak}d`}
          hint={stats.currentStreak > 0 ? `${stats.currentStreak} days now` : undefined}
          icon={Flame}
          tone="accent"
        />
      </Grid>

      <ActivityHeatmap days={calendar} />

      <Stack gap={4}>
        <SectionHeading title="Course by course" />
        {courses.length === 0 ? (
          <EmptyState
            title="No progress to show"
            description="Enrol in a course and your progress appears here."
            actions={
              <Button asChild>
                <Link href={routes.courses}>Browse courses</Link>
              </Button>
            }
          />
        ) : (
          <Card className="flex flex-col divide-y divide-border">
            {courses.map((course) => (
              <div key={course.enrollmentId} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={routes.course(course.slug)}
                    className="text-sm font-medium hover:text-primary"
                  >
                    {course.title}
                  </Link>
                  <span className="text-sm text-muted-foreground" data-numeric>
                    {course.completedLessons}/{course.totalLessons} ·{" "}
                    <span className="font-semibold text-foreground">{course.percent}%</span>
                  </span>
                </div>
                <ProgressBar
                  percent={course.percent}
                  label={`${course.title} progress`}
                  size="sm"
                />
              </div>
            ))}
          </Card>
        )}
      </Stack>

      <ActivityFeed events={activity} />
    </Stack>
  );
}
