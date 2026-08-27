"use client";

import * as React from "react";
import { Check, ClipboardList, Download, ExternalLink, FileText, ListChecks } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { useLessonProgress } from "@/features/learning/use-lesson-progress";
import type { ProgressActionResult } from "@/features/learning/actions";
import type { LearnerResource } from "@/features/learning/types";

interface CommonProps {
  courseId: string;
  courseSlug: string;
  lessonId: string;
  durationSeconds: number;
  initialCompleted: boolean;
  onCompletion?: (result: ProgressActionResult) => void;
}

/** Shared footer: the single completion control for non-video lessons. */
function CompletionBar({
  completed,
  saving,
  onToggle,
}: {
  completed: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        {saving ? "Saving…" : completed ? "Marked complete" : "Mark this done when you finish"}
      </p>
      <Button variant={completed ? "outline" : "primary"} size="sm" onClick={onToggle}>
        <Check className={cn("size-4", completed && "text-success")} aria-hidden="true" />
        {completed ? "Completed" : "Mark complete"}
      </Button>
    </div>
  );
}

function ResourceList({ resources }: { resources: LearnerResource[] }) {
  if (resources.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        Resources
      </h3>
      <ul className="flex flex-col gap-2">
        {resources.map((resource) => (
          <li key={resource.id}>
            {/*
              A file key is not a URL. Downloads are served through a signed,
              enrolment-checked endpoint in Phase 8 — linking the raw key here
              would make paid material publicly fetchable.
            */}
            {resource.externalUrl ? (
              <a
                href={resource.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:border-primary/40"
              >
                <ExternalLink
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1">{resource.title}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 text-sm">
                <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">{resource.title}</span>
                <Badge variant="warning" size="sm">
                  Signed downloads in Phase 8
                </Badge>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Article                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Article lesson.
 *
 * The body is authored HTML, so it is rendered with `dangerouslySetInnerHTML`.
 * What makes that safe is that the string arriving here has already been put
 * through `sanitizeLessonHtml` in the query layer — sanitised on read, so this
 * renderer is safe whatever a future authoring flow decides to store.
 */
function ArticleLesson({
  html,
  resources,
  ...common
}: CommonProps & { html: string | null; resources: LearnerResource[] }) {
  const progress = useLessonProgress({
    ...common,
    initialPositionSeconds: 0,
  });

  return (
    <div className="flex flex-col gap-6">
      {html ? (
        <div
          className={cn(
            "max-w-none text-base leading-relaxed",
            "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold",
            "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold",
            "[&_p]:mb-4 [&_p]:text-muted-foreground",
            "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground",
            "[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-muted-foreground",
            "[&_li]:mb-1.5",
            "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <EmptyState
          icon={<FileText aria-hidden="true" />}
          title="No content yet"
          description="This lesson has not been written."
        />
      )}

      <ResourceList resources={resources} />

      <CompletionBar
        completed={progress.completed}
        saving={progress.saving}
        onToggle={() => void progress.markComplete(!progress.completed)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PDF / downloadable resource                                               */
/* -------------------------------------------------------------------------- */

function PdfLesson({ resources, ...common }: CommonProps & { resources: LearnerResource[] }) {
  const progress = useLessonProgress({ ...common, initialPositionSeconds: 0 });

  return (
    <div className="flex flex-col gap-6">
      <Card variant="muted" className="p-6">
        <EmptyState
          bordered={false}
          icon={<Download aria-hidden="true" />}
          title="Attached resources"
          description="PDFs are served through a signed, enrolment-checked URL once the media pipeline lands in Phase 8."
        />
      </Card>

      <ResourceList resources={resources} />

      <CompletionBar
        completed={progress.completed}
        saving={progress.saving}
        onToggle={() => void progress.markComplete(!progress.completed)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Quiz / assignment placeholders                                            */
/* -------------------------------------------------------------------------- */

/**
 * Fallback for a quiz or assignment lesson that has not been authored yet.
 *
 * The real runners live in `components/assessment`. This shows only when an
 * instructor has created the lesson but not yet built the quiz or assignment
 * behind it — and stays inert, because marking it complete would put a false
 * signal into the progress record a certificate depends on.
 */
function PlaceholderLesson({ kind, title }: { kind: "QUIZ" | "ASSIGNMENT"; title: string }) {
  const isQuiz = kind === "QUIZ";

  return (
    <Card variant="muted" className="p-6">
      <EmptyState
        bordered={false}
        icon={isQuiz ? <ListChecks aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
        title={isQuiz ? "This quiz is not ready yet" : "This assignment is not ready yet"}
        description={
          isQuiz
            ? `“${title}” has no questions yet. Your instructor is still building it.`
            : `“${title}” has not been set up yet. Your instructor is still writing it.`
        }
        actions={
          <Button size="sm" disabled>
            {isQuiz ? "Start quiz" : "Open assignment"}
          </Button>
        }
      />
    </Card>
  );
}

export { ArticleLesson, PdfLesson, PlaceholderLesson, CompletionBar, ResourceList };
