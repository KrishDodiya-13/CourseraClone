"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";

import { routes } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LearnSidebar } from "@/components/learn/learn-sidebar";
import { VideoLesson } from "@/components/learn/video-lesson";
import { ArticleLesson, PdfLesson, PlaceholderLesson } from "@/components/learn/reading-lesson";
import { CompletionCelebration } from "@/components/learn/completion-celebration";
import { QuizRunner } from "@/components/assessment/quiz-runner";
import { AssignmentPanel } from "@/components/assessment/assignment-panel";
import { hasCelebrated } from "@/lib/local-progress";
import { DownloadButton } from "@/components/offline/download-button";
import { ReminderMenu } from "@/components/engagement/reminder-menu";
import type { ProgressActionResult } from "@/features/learning/actions";
import type { LearnerCourse, LearnerLesson } from "@/features/learning/types";

/**
 * The learning surface.
 *
 * Navigation between lessons is a shallow URL change (`?lesson=`) plus a
 * router refresh, so the lesson stays linkable and the back button works,
 * while the server re-resolves lock state and article bodies for the lesson
 * actually being opened.
 */
function LearnShell({
  course,
  activeLesson,
}: {
  course: LearnerCourse;
  activeLesson: LearnerLesson;
}) {
  const router = useRouter();
  const [contentsOpen, setContentsOpen] = React.useState(false);
  const [celebrating, setCelebrating] = React.useState(false);

  const openable = course.lessons.filter((lesson) => !lesson.locked);
  const positionInOpenable = openable.findIndex((lesson) => lesson.id === activeLesson.id);
  const previous = positionInOpenable > 0 ? openable[positionInOpenable - 1] : null;
  const next =
    positionInOpenable >= 0 && positionInOpenable < openable.length - 1
      ? openable[positionInOpenable + 1]
      : null;

  const goToLesson = React.useCallback(
    (lesson: LearnerLesson) => {
      if (lesson.locked) return;
      setContentsOpen(false);
      router.push(`${routes.learn(course.slug)}?lesson=${lesson.id}`, { scroll: true });
    },
    [course.slug, router],
  );

  /**
   * Fired only when the server reports the incomplete → complete transition.
   * The localStorage check is the second guard: replaying that same response
   * after a reload must not congratulate the learner again.
   */
  const handleCompletion = React.useCallback(
    (result: ProgressActionResult) => {
      if (result.justCompleted && !hasCelebrated(course.id)) {
        setCelebrating(true);
      }
      router.refresh();
    },
    [course.id, router],
  );

  const lessonProps = {
    courseId: course.id,
    courseSlug: course.slug,
    lessonId: activeLesson.id,
    durationSeconds: activeLesson.durationSeconds,
    initialCompleted: activeLesson.completed,
    onCompletion: handleCompletion,
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:gap-8 lg:px-8">
        {/* --- sidebar (desktop) ---------------------------------------- */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1">
            <LearnSidebar course={course} activeLessonId={activeLesson.id} onSelect={goToLesson} />
          </div>
        </aside>

        {/* --- main ------------------------------------------------------ */}
        <main className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden"
              onClick={() => setContentsOpen(true)}
            >
              <ListTree aria-hidden="true" />
              Contents
            </Button>

            <Link
              href={routes.course(course.slug)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {course.title}
            </Link>

            <span className="text-sm text-muted-foreground" data-numeric>
              · Lesson {activeLesson.index + 1} of {course.totalLessons}
            </span>

            {course.isComplete ? (
              <Badge variant="success" size="sm">
                Course complete
              </Badge>
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ReminderMenu courseId={course.id} courseTitle={course.title} />
              <DownloadButton courseSlug={course.slug} courseId={course.id} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-2xs tracking-wide text-primary uppercase">
              {activeLesson.sectionTitle}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">{activeLesson.title}</h1>
            {activeLesson.summary ? (
              <p className="text-base text-muted-foreground">{activeLesson.summary}</p>
            ) : null}
          </div>

          <Card className="p-5 sm:p-6">
            {activeLesson.type === "VIDEO" ? (
              <VideoLesson {...lessonProps} initialPositionSeconds={activeLesson.positionSeconds} />
            ) : activeLesson.type === "ARTICLE" ? (
              <ArticleLesson
                {...lessonProps}
                html={activeLesson.articleContent}
                resources={activeLesson.resources}
              />
            ) : activeLesson.type === "PDF" ? (
              <PdfLesson {...lessonProps} resources={activeLesson.resources} />
            ) : activeLesson.type === "QUIZ" && activeLesson.quiz ? (
              <QuizRunner quiz={activeLesson.quiz} courseSlug={course.slug} />
            ) : activeLesson.type === "ASSIGNMENT" && activeLesson.assignment ? (
              <AssignmentPanel assignment={activeLesson.assignment} courseSlug={course.slug} />
            ) : (
              <PlaceholderLesson kind={activeLesson.type} title={activeLesson.title} />
            )}
          </Card>

          {/* --- prev / next --------------------------------------------- */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            {previous ? (
              <Button variant="outline" onClick={() => goToLesson(previous)}>
                <ChevronLeft aria-hidden="true" />
                <span className="max-w-40 truncate">{previous.title}</span>
              </Button>
            ) : (
              <span />
            )}

            {next ? (
              <Button onClick={() => goToLesson(next)}>
                <span className="max-w-40 truncate">{next.title}</span>
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={routes.course(course.slug)}>Back to course</Link>
              </Button>
            )}
          </div>
        </main>
      </div>

      {/* --- sidebar (mobile) ------------------------------------------- */}
      <Sheet open={contentsOpen} onOpenChange={setContentsOpen}>
        <SheetContent side="left" className="w-[min(22rem,90vw)] p-0">
          <SheetHeader>
            <SheetTitle>Course contents</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <LearnSidebar course={course} activeLessonId={activeLesson.id} onSelect={goToLesson} />
          </div>
        </SheetContent>
      </Sheet>

      <CompletionCelebration
        open={celebrating}
        onOpenChange={setCelebrating}
        courseId={course.id}
        courseTitle={course.title}
        certificateSerial={course.certificateSerial}
      />
    </>
  );
}

export { LearnShell };
