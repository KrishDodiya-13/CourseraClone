"use client";

import * as React from "react";
import {
  Check,
  ClipboardList,
  FileText,
  ListChecks,
  Lock,
  Paperclip,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { LearnerCourse, LearnerLesson } from "@/features/learning/types";
import type { LessonKind } from "@/features/catalog/types";

const lessonIcons: Record<LessonKind, LucideIcon> = {
  VIDEO: PlayCircle,
  ARTICLE: FileText,
  PDF: Paperclip,
  QUIZ: ListChecks,
  ASSIGNMENT: ClipboardList,
};

/**
 * Course contents.
 *
 * Four states per lesson, each visually distinct: complete, current, available
 * and locked. A locked lesson renders as a disabled `<span>` rather than a
 * button, so it is not focusable and not clickable — the lock is not a
 * styling trick over a working control.
 */
function LearnSidebar({
  course,
  activeLessonId,
  onSelect,
}: {
  course: LearnerCourse;
  activeLessonId: string;
  onSelect: (lesson: LearnerLesson) => void;
}) {
  const activeSectionId = course.lessons.find((lesson) => lesson.id === activeLessonId)?.sectionId;

  return (
    <nav aria-label="Course contents" className="flex flex-col gap-4">
      {/* --- progress summary ------------------------------------------- */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
            Your progress
          </span>
          <span className="font-display text-lg font-semibold" data-numeric>
            {course.percent}%
          </span>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={course.percent}
          aria-label="Course progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${course.percent}%` }}
          />
        </div>

        <p className="text-sm text-muted-foreground" data-numeric>
          {course.lessons.filter((l) => l.isRequired && l.completed).length} of{" "}
          {course.requiredLessons} required lessons
        </p>
      </div>

      {/* --- contents ---------------------------------------------------- */}
      <div className="flex flex-col gap-3">
        {course.sections.map((section, sectionIndex) => {
          const done = section.lessons.filter((lesson) => lesson.completed).length;

          return (
            <details
              key={section.id}
              open={section.id === activeSectionId || sectionIndex === 0}
              className="group overflow-hidden rounded-lg border border-border"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                <span className="flex-1 text-sm font-semibold">{section.title}</span>
                <span className="font-mono text-2xs text-muted-foreground" data-numeric>
                  {done}/{section.lessons.length}
                </span>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>

              <ul className="divide-y divide-border">
                {section.lessons.map((lesson) => {
                  const Icon = lessonIcons[lesson.type];
                  const isActive = lesson.id === activeLessonId;

                  if (lesson.locked) {
                    return (
                      <li key={lesson.id}>
                        <span
                          aria-disabled="true"
                          className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-2.5 text-sm opacity-55"
                        >
                          <Lock
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="flex-1 text-left text-muted-foreground">
                            {lesson.title}
                          </span>
                          <span className="sr-only">Locked — finish the previous lesson first</span>
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(lesson)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                          isActive
                            ? "bg-primary-subtle text-primary-subtle-foreground"
                            : "hover:bg-secondary",
                        )}
                      >
                        {lesson.completed ? (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success">
                            <Check
                              className="size-2.5 text-success-foreground"
                              aria-hidden="true"
                            />
                          </span>
                        ) : (
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground",
                            )}
                            aria-hidden="true"
                          />
                        )}

                        <span className="flex-1">
                          {lesson.title}
                          {lesson.completed ? <span className="sr-only"> (completed)</span> : null}
                          {isActive ? <span className="sr-only"> (current lesson)</span> : null}
                        </span>

                        {!lesson.isRequired ? (
                          <Badge variant="neutral" size="sm">
                            Optional
                          </Badge>
                        ) : null}

                        {lesson.durationSeconds > 0 ? (
                          <span
                            className="shrink-0 font-mono text-2xs text-muted-foreground"
                            data-numeric
                          >
                            {formatDuration(Math.round(lesson.durationSeconds / 60))}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </nav>
  );
}

export { LearnSidebar };
