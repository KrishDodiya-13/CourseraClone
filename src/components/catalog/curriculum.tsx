import {
  ClipboardList,
  FileText,
  ListChecks,
  Paperclip,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

import { formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { CurriculumSection, LessonKind } from "@/features/catalog/types";

const lessonIcons: Record<LessonKind, LucideIcon> = {
  VIDEO: PlayCircle,
  ARTICLE: FileText,
  PDF: Paperclip,
  QUIZ: ListChecks,
  ASSIGNMENT: ClipboardList,
};

const lessonLabels: Record<LessonKind, string> = {
  VIDEO: "Video",
  ARTICLE: "Article",
  PDF: "Resource",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
};

/**
 * The public curriculum.
 *
 * Titles, types and durations are listed for everyone — that is what a buyer
 * needs to judge the course. What is deliberately not here: playback ids, file
 * keys and article bodies. Those are granted per request after an enrolment
 * check, so nothing on this page can be scraped into free access.
 *
 * Rendered with native `<details>` so sections expand without JavaScript and
 * are keyboard-operable for free.
 */
function Curriculum({ sections }: { sections: CurriculumSection[] }) {
  const totalLessons = sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const totalSeconds = sections.reduce(
    (sum, section) =>
      sum + section.lessons.reduce((inner, lesson) => inner + lesson.durationSeconds, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" data-numeric>
        {sections.length} sections · {totalLessons} lessons ·{" "}
        {formatDuration(Math.round(totalSeconds / 60))} total
      </p>

      <div className="overflow-hidden rounded-xl border border-border">
        {sections.map((section, index) => {
          const sectionSeconds = section.lessons.reduce(
            (sum, lesson) => sum + lesson.durationSeconds,
            0,
          );

          return (
            <details
              key={section.id}
              open={index === 0}
              className="group border-b border-border last:border-b-0"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 bg-muted/50 px-4 py-3 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{section.title}</span>
                  {section.description ? (
                    <span className="block text-sm text-muted-foreground">
                      {section.description}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-2xs text-muted-foreground" data-numeric>
                  {section.lessons.length} · {formatDuration(Math.round(sectionSeconds / 60))}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>

              <ul className="divide-y divide-border">
                {section.lessons.map((lesson) => {
                  const Icon = lessonIcons[lesson.type];
                  return (
                    <li key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1">
                        {lesson.title}
                        <span className="sr-only"> ({lessonLabels[lesson.type]})</span>
                      </span>
                      {lesson.isFreePreview ? (
                        <Badge variant="success" size="sm">
                          Preview
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
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export { Curriculum };
