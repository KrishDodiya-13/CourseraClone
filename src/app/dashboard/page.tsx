import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Compass,
  Flame,
  GraduationCap,
  Heart,
  PlayCircle,
} from "lucide-react";

import { routes } from "@/lib/routes";
import { formatDuration } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Grid, Inline, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { StatTile, ProgressBar, SectionHeading } from "@/components/dashboard/stat-tile";
import { CourseProgressCard } from "@/components/dashboard/course-progress-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { greetingFor } from "@/features/dashboard/greeting";
import { db } from "@/server/db";
import { StreakBadge } from "@/components/engagement/streak-badge";
import {
  getActivityCalendar,
  getContinueLearning,
  getEnrolledCourses,
  getLearningStats,
  getRecentActivity,
} from "@/features/dashboard/queries";

export default async function DashboardOverviewPage() {
  const user = await requireAuth(routes.dashboard);

  const [stats, courses, resume, activity, calendar] = await Promise.all([
    getLearningStats(user.id),
    getEnrolledCourses(user.id),
    getContinueLearning(user.id),
    getRecentActivity(user.id, 8),
    getActivityCalendar(user.id),
  ]);

  const firstName = user.name.split(" ")[0] ?? user.name;

  // Read in the learner's own timezone, so the greeting matches their clock
  // rather than the server's.
  const timezone = await db.user
    .findUnique({ where: { id: user.id }, select: { timezone: true } })
    .then((row) => row?.timezone ?? "UTC");
  const greeting = greetingFor(timezone);
  const inProgress = courses.filter((course) => course.status === "ACTIVE").slice(0, 3);

  return (
    <Stack gap={8}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">
            {greeting}, {firstName}
          </h1>
          <p className="text-base text-muted-foreground">
            {stats.enrolledCount === 0
              ? "You have not enrolled in anything yet."
              : `${stats.activeCount} in progress · ${stats.completedCount} finished`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StreakBadge days={stats.currentStreak} />
          <Button variant="outline" asChild>
            <Link href={routes.courses}>
              <Compass aria-hidden="true" />
              Browse courses
            </Link>
          </Button>
        </div>
      </div>

      {/* --- statistics ------------------------------------------------- */}
      <Grid cols={4} gap={4}>
        <StatTile
          label="Enrolled"
          value={stats.enrolledCount}
          hint={stats.activeCount > 0 ? `${stats.activeCount} in progress` : undefined}
          icon={BookOpen}
          tone="primary"
        />
        <StatTile
          label="Completed"
          value={stats.completedCount}
          hint={stats.certificateCount > 0 ? `${stats.certificateCount} certificates` : undefined}
          icon={GraduationCap}
          tone="success"
        />
        <StatTile
          label="Lessons done"
          value={stats.lessonsCompleted}
          hint={stats.minutesLearned > 0 ? formatDuration(stats.minutesLearned) : undefined}
          icon={PlayCircle}
        />
        <StatTile
          label="Current streak"
          value={stats.currentStreak === 0 ? "—" : `${stats.currentStreak}d`}
          hint={
            stats.longestStreak > 0 ? `Best ${stats.longestStreak} days` : "Study today to start"
          }
          icon={Flame}
          tone="accent"
        />
      </Grid>

      {/* --- continue learning ------------------------------------------ */}
      {resume ? (
        <Stack gap={4}>
          <SectionHeading title="Continue learning" />
          <Card variant="elevated" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Badge variant="primary" size="sm">
                {resume.categoryName}
              </Badge>
              <Link
                href={routes.course(resume.slug)}
                className="text-lg font-semibold hover:text-primary"
              >
                {resume.title}
              </Link>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground" data-numeric>
                  {resume.completedLessons} of {resume.totalLessons} lessons
                </span>
                <span className="font-semibold" data-numeric>
                  {resume.percent}%
                </span>
              </div>
              <ProgressBar percent={resume.percent} label={`${resume.title} progress`} />
            </div>

            <Button size="lg" asChild className="shrink-0">
              <Link
                href={
                  resume.nextLessonId
                    ? `${routes.learn(resume.slug)}?lesson=${resume.nextLessonId}`
                    : routes.learn(resume.slug)
                }
              >
                <PlayCircle aria-hidden="true" />
                {resume.completedLessons === 0 ? "Start" : "Continue"}
              </Link>
            </Button>
          </Card>
        </Stack>
      ) : null}

      {/* --- in progress ------------------------------------------------- */}
      <Stack gap={4}>
        <SectionHeading
          title="Your courses"
          action={
            courses.length > 0 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={routes.dashboardCourses}>
                  View all
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : null
          }
        />

        {courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen aria-hidden="true" />}
            title="No courses yet"
            description="Enrol in something and it will appear here with your progress."
            actions={
              <Button asChild>
                <Link href={routes.courses}>Browse the catalogue</Link>
              </Button>
            }
          />
        ) : (
          <Stack gap={4}>
            {inProgress.map((course) => (
              <CourseProgressCard key={course.enrollmentId} course={course} />
            ))}
          </Stack>
        )}
      </Stack>

      {/* --- activity ---------------------------------------------------- */}
      {/* `[&>*]:min-w-0` on the track children: a grid item defaults to
          `min-width: auto`, so a single column sizes to the widest item's
          min-content — which the 26-week activity grid pushed to 395px on a
          320px screen, scrolling the whole page sideways. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
        <ActivityHeatmap days={calendar} />
        <ActivityFeed events={activity} />
      </div>

      {/* --- shortcuts --------------------------------------------------- */}
      <Grid cols={3} gap={4}>
        <ShortcutCard
          href={routes.dashboardCertificates}
          icon={Award}
          label="Certificates"
          value={stats.certificateCount}
        />
        <ShortcutCard
          href={routes.dashboardWishlist}
          icon={Heart}
          label="Wishlist"
          value={stats.wishlistCount}
        />
        <ShortcutCard
          href={routes.profile}
          icon={Flame}
          label="Badges earned"
          value={stats.badgeCount}
        />
      </Grid>
    </Stack>
  );
}

function ShortcutCard({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: typeof Award;
  label: string;
  value: number;
}) {
  return (
    <Card interactive className="relative flex items-center gap-3 p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <Inline gap={2} className="flex-1">
        <Link href={href} className="text-sm font-medium after:absolute after:inset-0">
          {label}
        </Link>
      </Inline>
      <span className="font-display text-xl font-semibold" data-numeric>
        {value}
      </span>
    </Card>
  );
}
