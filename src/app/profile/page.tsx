import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  BookOpen,
  CalendarDays,
  Flame,
  GraduationCap,
  Globe,
  Lock,
  MapPin,
  Medal,
  PlayCircle,
  Trophy,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { formatDate, formatDuration, formatShortDate } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/avatar";
import { Container, Grid, Inline, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { StatTile, ProgressBar } from "@/components/dashboard/stat-tile";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { StreakBadge } from "@/components/engagement/streak-badge";
import {
  getActivityCalendar,
  getCertificates,
  getEnrolledCourses,
  getLearningStats,
  getProfile,
  getUnearnedBadges,
} from "@/features/dashboard/queries";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

const tierTone = {
  BRONZE: "bg-accent-subtle text-accent-subtle-foreground",
  SILVER: "bg-secondary text-secondary-foreground",
  GOLD: "bg-warning-subtle text-warning-foreground",
  PLATINUM: "bg-primary-subtle text-primary-subtle-foreground",
} as const;

/**
 * The signed-in learner's profile.
 *
 * Every figure comes from this user's own rows — enrolments, completions,
 * certificates, badges, activity log and streak. There is no placeholder
 * content: an account with no history shows honest zeros and an empty state,
 * because a profile that invents numbers is worse than one that admits it is
 * new.
 */
export default async function ProfilePage() {
  const user = await requireAuth(routes.profile);

  const [profile, stats, courses, certificates, calendar, unearned] = await Promise.all([
    getProfile(user.id),
    getLearningStats(user.id),
    getEnrolledCourses(user.id),
    getCertificates(user.id),
    getActivityCalendar(user.id),
    getUnearnedBadges(user.id),
  ]);

  if (!profile) notFound();

  const completed = courses.filter(
    (course) => course.status === "COMPLETED" || course.percent >= 100,
  );
  const inProgress = courses.filter((course) => course.status === "ACTIVE" && course.percent < 100);

  const joined = formatDate(profile.joinedAt);

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={8}>
          {/* --- identity ------------------------------------------------ */}
          <Card variant="elevated" className="relative overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(80%_100%_at_50%_0%,var(--color-primary-subtle),transparent)]"
            />

            <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6">
              <UserAvatar
                name={profile.name}
                src={profile.avatarUrl}
                size="xl"
                className="shrink-0"
              />

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold sm:text-3xl">{profile.name}</h1>
                  <Badge variant="primary" size="sm">
                    {profile.role.toLowerCase()}
                  </Badge>
                </div>

                {profile.headline ? (
                  <p className="text-base text-muted-foreground">{profile.headline}</p>
                ) : null}

                {profile.bio ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {profile.bio}
                  </p>
                ) : null}

                <Inline gap={4} className="text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    Joined {joined}
                  </span>
                  {profile.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {profile.location}
                    </span>
                  ) : null}
                  {profile.websiteUrl ? (
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Globe className="size-3.5" aria-hidden="true" />
                      Website
                    </a>
                  ) : null}
                </Inline>

                {/*
                  Email is shown only to the account owner — this page is the
                  signed-in learner's own profile, and it is noindex.
                */}
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>

              <Button variant="outline" asChild className="shrink-0">
                <Link href={routes.settings}>Edit profile</Link>
              </Button>
            </div>
          </Card>

          {/* --- statistics ---------------------------------------------- */}
          <Grid cols={4} gap={4}>
            <StatTile
              label="Enrolled"
              value={stats.enrolledCount}
              hint={inProgress.length > 0 ? `${inProgress.length} in progress` : undefined}
              icon={BookOpen}
              tone="primary"
            />
            <StatTile
              label="Completed"
              value={stats.completedCount}
              icon={GraduationCap}
              tone="success"
            />
            <StatTile
              label="Certificates"
              value={stats.certificateCount}
              icon={Award}
              tone="accent"
            />
            <StatTile
              label="Lessons"
              value={stats.lessonsCompleted}
              hint={stats.minutesLearned > 0 ? formatDuration(stats.minutesLearned) : undefined}
              icon={PlayCircle}
            />
          </Grid>

          {/* --- streaks -------------------------------------------------- */}
          <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  stats.currentStreak > 0
                    ? "bg-accent-subtle text-accent-subtle-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                <Flame className="size-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                  Current streak
                </span>
                <span className="font-display text-2xl font-semibold" data-numeric>
                  {stats.currentStreak} {stats.currentStreak === 1 ? "day" : "days"}
                </span>
              </div>
            </div>

            <Separator orientation="vertical" className="hidden h-12 sm:block" />

            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Trophy className="size-6" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                  Longest streak
                </span>
                <span className="font-display text-2xl font-semibold" data-numeric>
                  {stats.longestStreak} {stats.longestStreak === 1 ? "day" : "days"}
                </span>
              </div>
            </div>

            <div className="sm:ml-auto">
              <StreakBadge days={stats.currentStreak} size="lg" />
            </div>

            <p className="text-sm text-muted-foreground sm:max-w-48">
              {stats.currentStreak === 0
                ? "Finish a lesson today to start a streak."
                : "Keep going — a day counts once you finish any lesson."}
            </p>
          </Card>

          <ActivityHeatmap days={calendar} />

          {/* --- badges --------------------------------------------------- */}
          <Stack gap={4}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Badges</h2>
              <p className="text-sm text-muted-foreground" data-numeric>
                {profile.badges.length} of {profile.badges.length + unearned.length} earned
              </p>
            </div>

            {profile.badges.length === 0 && unearned.length === 0 ? (
              <EmptyState
                icon={<Medal aria-hidden="true" />}
                title="No badges available yet"
                description="Badges appear here as they are added to the platform."
              />
            ) : (
              <Grid cols={4} gap={4}>
                {profile.badges.map((badge) => (
                  <Card key={badge.id} className="flex flex-col gap-2 p-4">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg",
                        tierTone[badge.tier],
                      )}
                    >
                      <Medal className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold">{badge.name}</span>
                    <span className="text-sm text-muted-foreground">{badge.description}</span>
                    <Badge variant="neutral" size="sm" className="mt-auto">
                      {badge.tier.toLowerCase()}
                    </Badge>
                  </Card>
                ))}

                {/* Unearned badges are shown greyed rather than hidden, so the
                    set of what is achievable is visible. */}
                {unearned.map((badge) => (
                  <Card
                    key={badge.id}
                    variant="muted"
                    className="flex flex-col gap-2 p-4 opacity-60"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Lock className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold">{badge.name}</span>
                    <span className="text-sm text-muted-foreground">{badge.description}</span>
                    <Badge variant="outline" size="sm" className="mt-auto">
                      Not earned
                    </Badge>
                  </Card>
                ))}
              </Grid>
            )}
          </Stack>

          {/* --- courses -------------------------------------------------- */}
          <Stack gap={4}>
            <h2 className="text-lg font-semibold">Courses</h2>

            {courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen aria-hidden="true" />}
                title="No courses yet"
                description="Enrolled courses appear here with your progress."
                actions={
                  <Button asChild>
                    <Link href={routes.courses}>Browse the catalogue</Link>
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
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {course.certificateSerial ? (
                          <Badge variant="accent" size="sm">
                            <Award aria-hidden="true" />
                            Certified
                          </Badge>
                        ) : null}
                        <span data-numeric className="font-semibold text-foreground">
                          {course.percent}%
                        </span>
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

          {/* --- certificates --------------------------------------------- */}
          {certificates.length > 0 ? (
            <Stack gap={4}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Certificates</h2>
                <Button variant="outline" size="sm" asChild>
                  <Link href={routes.dashboardCertificates}>View all</Link>
                </Button>
              </div>

              <Grid cols={3} gap={4}>
                {certificates.slice(0, 3).map((certificate) => (
                  <Card
                    key={certificate.id}
                    interactive
                    className="relative flex flex-col gap-2 p-4"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent-subtle text-accent-subtle-foreground">
                      <Award className="size-4" aria-hidden="true" />
                    </span>
                    <Link
                      href={routes.certificate(certificate.serial)}
                      className="text-sm font-semibold after:absolute after:inset-0 hover:text-primary"
                    >
                      {certificate.courseTitle}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {formatShortDate(certificate.issuedAt)}
                    </span>
                    <code className="mt-auto font-mono text-2xs break-all text-muted-foreground">
                      {certificate.serial}
                    </code>
                  </Card>
                ))}
              </Grid>
            </Stack>
          ) : null}

          <p className="text-sm text-muted-foreground">
            {completed.length > 0
              ? `${completed.length} of ${courses.length} courses finished.`
              : "Nothing finished yet — that is where certificates come from."}
          </p>
        </Stack>
      </Container>
    </Section>
  );
}
