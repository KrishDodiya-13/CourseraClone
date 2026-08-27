"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  ListChecks,
  Paperclip,
  PlayCircle,
  VideoOff,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { LoadingState } from "@/components/states/loading-state";
import { listStoredCourses, type OfflineLesson, type StoredCourse } from "@/offline/db";
import { queueProgress } from "@/offline/sync";
import { useOffline } from "@/components/offline/offline-provider";

const lessonIcons: Record<OfflineLesson["type"], LucideIcon> = {
  VIDEO: PlayCircle,
  ARTICLE: FileText,
  PDF: Paperclip,
  QUIZ: ListChecks,
  ASSIGNMENT: ClipboardList,
};

/**
 * The offline reader.
 *
 * Entirely client-side and entirely fed from IndexedDB — no server call is
 * made anywhere in this component. That is the point: the service worker
 * serves this route's shell from the precache when a navigation cannot reach
 * the network, and everything below hydrates from local storage.
 *
 * Progress recorded here goes into the outbox, not to the server. It reaches
 * the server when connectivity returns, through the sync queue.
 */
function OfflineReader() {
  const { online, refreshPending } = useOffline();

  const [courses, setCourses] = React.useState<StoredCourse[] | null>(null);
  const [activeCourseId, setActiveCourseId] = React.useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = React.useState<string | null>(null);
  const [completedLocally, setCompletedLocally] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    void listStoredCourses()
      .then((found) => {
        setCourses(found);
        const first = found[0];
        if (first) {
          setActiveCourseId(first.courseId);
          setCompletedLocally(
            new Set(
              first.bundle.progress.filter((row) => row.completed).map((row) => row.lessonId),
            ),
          );
        }
      })
      .catch(() => setCourses([]));
  }, []);

  const activeCourse = courses?.find((course) => course.courseId === activeCourseId) ?? null;

  const flatLessons = React.useMemo(
    () =>
      activeCourse
        ? activeCourse.bundle.sections.flatMap((section) =>
            section.lessons.map((lesson) => ({ lesson, sectionTitle: section.title })),
          )
        : [],
    [activeCourse],
  );

  const activeEntry =
    flatLessons.find((entry) => entry.lesson.id === activeLessonId) ?? flatLessons[0] ?? null;
  const activeIndex = activeEntry
    ? flatLessons.findIndex((entry) => entry.lesson.id === activeEntry.lesson.id)
    : -1;

  async function toggleComplete(lessonId: string) {
    if (!activeCourse) return;
    const next = new Set(completedLocally);
    const nowComplete = !next.has(lessonId);

    if (nowComplete) next.add(lessonId);
    else next.delete(lessonId);
    setCompletedLocally(next);

    // Queued, never sent directly. Note that only completion *set* to true is
    // queued — un-completing offline is intentionally not synced, because a
    // stale queue entry must not be able to revoke progress on the server.
    await queueProgress({
      courseId: activeCourse.courseId,
      lessonId,
      positionSeconds: 0,
      completed: nowComplete ? true : undefined,
    });
    refreshPending();
  }

  /* --- states ----------------------------------------------------------- */

  if (courses === null) {
    return <LoadingState size="lg" label="Opening your downloads" />;
  }

  if (courses.length === 0) {
    return (
      <Section spacing="lg">
        <Container size="sm">
          <EmptyState
            icon={<WifiOff aria-hidden="true" />}
            title={online ? "Nothing downloaded yet" : "You are offline"}
            description={
              online
                ? "Open a course you are enrolled in and choose Download for offline. Articles and images are stored on this device; videos are not."
                : "No courses have been downloaded to this device. Reconnect to browse Coursera."
            }
            size="lg"
            actions={
              online ? (
                <Button asChild>
                  <Link href={routes.dashboard}>Go to my learning</Link>
                </Button>
              ) : null
            }
          />
        </Container>
      </Section>
    );
  }

  if (!activeCourse || !activeEntry) {
    return <LoadingState size="lg" label="Opening your downloads" />;
  }

  const { lesson, sectionTitle } = activeEntry;
  const isComplete = completedLocally.has(lesson.id);
  const previous = activeIndex > 0 ? flatLessons[activeIndex - 1] : null;
  const next = activeIndex < flatLessons.length - 1 ? flatLessons[activeIndex + 1] : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
      {/* --- contents --------------------------------------------------- */}
      <aside className="w-full shrink-0 lg:w-80">
        <Stack gap={4}>
          <Badge variant={online ? "success" : "warning"}>
            {online ? "Online · reading downloaded copy" : "Offline"}
          </Badge>

          {courses.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="offline-course"
                className="font-mono text-2xs tracking-wide text-muted-foreground uppercase"
              >
                Downloaded courses
              </label>
              <select
                id="offline-course"
                value={activeCourse.courseId}
                onChange={(event) => {
                  setActiveCourseId(event.target.value);
                  setActiveLessonId(null);
                }}
                className="h-9.5 rounded-lg border border-input bg-card px-3 text-sm"
              >
                {courses.map((course) => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <nav aria-label="Downloaded curriculum" className="flex flex-col gap-3">
            {activeCourse.bundle.sections.map((section, sectionIndex) => (
              <details
                key={section.id}
                open={sectionIndex === 0 || section.lessons.some((l) => l.id === lesson.id)}
                className="group overflow-hidden rounded-lg border border-border"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/50 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{section.title}</span>
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <ul className="divide-y divide-border">
                  {section.lessons.map((item) => {
                    const Icon = lessonIcons[item.type];
                    const active = item.id === lesson.id;
                    const done = completedLocally.has(item.id);

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setActiveLessonId(item.id)}
                          aria-current={active ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                            active
                              ? "bg-primary-subtle text-primary-subtle-foreground"
                              : "hover:bg-secondary",
                          )}
                        >
                          {done ? (
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success">
                              <Check
                                className="size-2.5 text-success-foreground"
                                aria-hidden="true"
                              />
                            </span>
                          ) : (
                            <Icon
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                          <span className="flex-1">{item.title}</span>
                          {item.type === "VIDEO" ? (
                            <VideoOff
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label="Video — needs a connection"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </nav>
        </Stack>
      </aside>

      {/* --- lesson ------------------------------------------------------ */}
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-2xs tracking-wide text-primary uppercase">{sectionTitle}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{lesson.title}</h1>
          {lesson.summary ? (
            <p className="text-base text-muted-foreground">{lesson.summary}</p>
          ) : null}
          <p className="text-sm text-muted-foreground" data-numeric>
            Lesson {activeIndex + 1} of {flatLessons.length}
            {lesson.durationSeconds > 0
              ? ` · ${formatDuration(Math.round(lesson.durationSeconds / 60))}`
              : ""}
          </p>
        </div>

        <Card className="p-5 sm:p-6">
          {lesson.type === "VIDEO" ? (
            <EmptyState
              icon={<VideoOff aria-hidden="true" />}
              title="Video is not available offline"
              description="Videos are never downloaded — they are large, and licensed for streaming only. Reconnect to watch this lesson; everything else in this course is readable now."
              actions={
                online ? (
                  <Button size="sm" asChild>
                    <Link href={`${routes.learn(activeCourse.slug)}?lesson=${lesson.id}`}>
                      Watch online
                    </Link>
                  </Button>
                ) : null
              }
            />
          ) : lesson.type === "ARTICLE" && lesson.articleContent ? (
            <div
              className={cn(
                "max-w-none text-base leading-relaxed",
                "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold",
                "[&_p]:mb-4 [&_p]:text-muted-foreground",
                "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground",
                "[&_li]:mb-1.5",
                "[&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg",
                "[&_a]:text-primary [&_a]:underline",
              )}
              dangerouslySetInnerHTML={{ __html: lesson.articleContent }}
            />
          ) : (
            <EmptyState
              icon={<BookOpenCheck aria-hidden="true" />}
              title={
                lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT"
                  ? "This needs a connection"
                  : "Nothing downloaded for this lesson"
              }
              description={
                lesson.type === "QUIZ" || lesson.type === "ASSIGNMENT"
                  ? "Quizzes and assignments are graded on the server, so they cannot run offline."
                  : "Only article text and its images are stored on this device."
              }
            />
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {online ? "Progress syncs as you go" : "Progress is saved and will sync later"}
            </p>
            <Button
              variant={isComplete ? "outline" : "primary"}
              size="sm"
              onClick={() => void toggleComplete(lesson.id)}
            >
              <Check className={cn("size-4", isComplete && "text-success")} aria-hidden="true" />
              {isComplete ? "Completed" : "Mark complete"}
            </Button>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          {previous ? (
            <Button variant="outline" onClick={() => setActiveLessonId(previous.lesson.id)}>
              <ChevronLeft aria-hidden="true" />
              <span className="max-w-40 truncate">{previous.lesson.title}</span>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button onClick={() => setActiveLessonId(next.lesson.id)}>
              <span className="max-w-40 truncate">{next.lesson.title}</span>
              <ChevronRight aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export { OfflineReader };
