import Link from "next/link";
import { Award, CircleCheck, PlayCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { ProgressBar } from "@/components/dashboard/stat-tile";
import type { EnrolledCourse } from "@/features/dashboard/queries";

/** Relative time, without a date library for four possible strings. */
function relativeDay(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

/**
 * An enrolled course with its progress.
 *
 * The action is decided from the data, not from a prop: a finished course
 * offers its certificate, an untouched one offers to start, and anything in
 * between offers to continue from the first incomplete lesson.
 */
function CourseProgressCard({ course, className }: { course: EnrolledCourse; className?: string }) {
  const isComplete = course.status === "COMPLETED" || course.percent >= 100;
  const notStarted = course.completedLessons === 0;
  const lastSeen = relativeDay(course.lastActivityAt);

  const continueHref = course.nextLessonId
    ? `${routes.learn(course.slug)}?lesson=${course.nextLessonId}`
    : routes.learn(course.slug);

  return (
    <Card className={cn("flex flex-col overflow-hidden sm:flex-row", className)}>
      <Link
        href={routes.course(course.slug)}
        className="w-full shrink-0 sm:w-44"
        aria-label={course.title}
      >
        <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary" size="sm">
            {course.categoryName}
          </Badge>
          {isComplete ? (
            <Badge variant="success" size="sm">
              <CircleCheck aria-hidden="true" />
              Complete
            </Badge>
          ) : null}
          {lastSeen && !isComplete ? (
            <span className="text-sm text-muted-foreground">Last studied {lastSeen}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Link
            href={routes.course(course.slug)}
            className="text-base font-semibold hover:text-primary"
          >
            {course.title}
          </Link>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserAvatar name={course.instructorName} src={course.instructorAvatarUrl} size="xs" />
            {course.instructorName}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground" data-numeric>
              {course.completedLessons} of {course.totalLessons} lessons
            </span>
            <span className="font-semibold" data-numeric>
              {course.percent}%
            </span>
          </div>
          <ProgressBar percent={course.percent} label={`${course.title} progress`} size="sm" />
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {isComplete && course.certificateSerial ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={routes.certificates}>
                <Award aria-hidden="true" />
                Certificate
              </Link>
            </Button>
          ) : null}

          <Button size="sm" variant={isComplete ? "ghost" : "primary"} asChild>
            <Link href={continueHref}>
              <PlayCircle aria-hidden="true" />
              {isComplete ? "Review" : notStarted ? "Start course" : "Continue"}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export { CourseProgressCard, relativeDay };
