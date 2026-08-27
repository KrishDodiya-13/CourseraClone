"use client";

import * as React from "react";
import { useActionState } from "react";
import { CircleCheck, Clock3, ExternalLink, MessageSquare, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitAssignmentAction, type ActionResult } from "@/features/assessment/actions";
import type { AssignmentView, SubmissionView } from "@/features/assessment/queries";

const statusLabels: Record<SubmissionView["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting review",
  IN_REVIEW: "Being reviewed",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
};

const statusTone: Record<SubmissionView["status"], "neutral" | "info" | "success" | "warning"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  IN_REVIEW: "info",
  APPROVED: "success",
  CHANGES_REQUESTED: "warning",
};

/**
 * Assignment panel.
 *
 * Grades and feedback are read-only here — they are written by the instructor
 * through their own action, and this component has no path to set either. A
 * learner editing this form can change what they submit, never what it scored.
 */
function AssignmentPanel({
  assignment,
  courseSlug,
}: {
  assignment: AssignmentView;
  courseSlug: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    submitAssignmentAction,
    null,
  );

  const latest = assignment.latest;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{assignment.title}</h3>
          <Badge variant="neutral" size="sm">
            {assignment.maxPoints} points
          </Badge>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
          {assignment.instructions}
        </p>
      </div>

      {assignment.rubric ? (
        <Card variant="muted" className="p-4">
          <h4 className="mb-1.5 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
            How this is marked
          </h4>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{assignment.rubric}</p>
        </Card>
      ) : null}

      {/* --- current status ------------------------------------------- */}
      {latest ? (
        <Card
          className={cn(
            "flex flex-col gap-3 p-4",
            latest.status === "APPROVED" && "border-success/40",
            latest.status === "CHANGES_REQUESTED" && "border-warning/40",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusTone[latest.status]}>{statusLabels[latest.status]}</Badge>
            <span className="text-sm text-muted-foreground" data-numeric>
              Attempt {latest.attemptNumber}
            </span>
            {latest.submittedAt ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {new Date(latest.submittedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>

          {latest.score !== null ? (
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold" data-numeric>
                {latest.score}
              </span>
              <span className="text-sm text-muted-foreground" data-numeric>
                / {assignment.maxPoints}
              </span>
            </div>
          ) : null}

          {latest.feedback ? (
            <div className="flex flex-col gap-1.5 rounded-lg bg-muted p-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                <MessageSquare className="size-3" aria-hidden="true" />
                Feedback{latest.reviewerName ? ` from ${latest.reviewerName}` : ""}
              </span>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{latest.feedback}</p>
            </div>
          ) : latest.status === "SUBMITTED" ? (
            <p className="text-sm text-muted-foreground">
              Your instructor has not reviewed this yet.
            </p>
          ) : null}

          {latest.submissionUrl ? (
            <a
              href={latest.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Your submitted link
            </a>
          ) : null}
        </Card>
      ) : null}

      {/* --- submit form ---------------------------------------------- */}
      {assignment.canSubmit ? (
        <>
          <Separator />
          <form action={formAction} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="lessonId" value={assignment.lessonId} />
            <input type="hidden" name="courseSlug" value={courseSlug} />

            {state?.message ? (
              <p
                className={cn("text-sm", state.ok ? "text-success" : "text-danger")}
                role={state.ok ? "status" : "alert"}
              >
                {state.message}
              </p>
            ) : null}

            <Field error={state?.fieldErrors?.submissionText?.[0]}>
              <FieldLabel>Your answer</FieldLabel>
              <Textarea
                name="submissionText"
                rows={8}
                defaultValue={latest?.submissionText ?? ""}
                placeholder="Write your response here."
              />
              <FieldDescription>
                {latest
                  ? "Resubmitting replaces your previous answer."
                  : "Markdown is not rendered — plain text is fine."}
              </FieldDescription>
            </Field>

            {assignment.allowUrlSubmission ? (
              <Field error={state?.fieldErrors?.submissionUrl?.[0]}>
                <FieldLabel>Link (optional)</FieldLabel>
                <Input
                  name="submissionUrl"
                  type="url"
                  inputMode="url"
                  defaultValue={latest?.submissionUrl ?? ""}
                  placeholder="https://github.com/you/your-work"
                  startIcon={<ExternalLink />}
                />
                <FieldDescription>
                  A repository, document or deployed page holding your work.
                </FieldDescription>
              </Field>
            ) : null}

            {/*
              File upload is declared per assignment but inert: it needs an
              object-storage provider with signed uploads, which is not
              configured. Showing a disabled control with the reason is more
              honest than a button that fails on click.
            */}
            {assignment.allowFileUpload ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border p-3">
                <Paperclip
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">File upload</p>
                  <p className="text-sm text-muted-foreground">
                    Not available yet — direct file upload needs object storage, which is not
                    configured on this deployment. Use the link field to point at your work.
                  </p>
                </div>
              </div>
            ) : null}

            <Button
              type="submit"
              isLoading={pending}
              loadingText="Submitting"
              className="self-start"
            >
              {latest ? "Resubmit" : "Submit for review"}
            </Button>
          </form>
        </>
      ) : latest?.status === "APPROVED" ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-success">
          <CircleCheck className="size-4" aria-hidden="true" />
          Approved — nothing more to do.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          This assignment does not allow resubmission.
        </p>
      )}

      {/* --- history ---------------------------------------------------- */}
      {assignment.submissions.length > 1 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <h4 className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              Earlier submissions
            </h4>
            <ul className="flex flex-col gap-1.5">
              {assignment.submissions.slice(1).map((submission) => (
                <li
                  key={submission.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2.5 text-sm"
                >
                  <span className="text-muted-foreground" data-numeric>
                    Attempt {submission.attemptNumber}
                  </span>
                  <Badge variant={statusTone[submission.status]} size="sm">
                    {statusLabels[submission.status]}
                  </Badge>
                  {submission.score !== null ? (
                    <span className="ml-auto font-medium" data-numeric>
                      {submission.score}/{assignment.maxPoints}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}

export { AssignmentPanel, statusLabels, statusTone };
