"use client";

import { useActionState } from "react";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gradeSubmissionAction, type ActionResult } from "@/features/assessment/actions";
import { statusLabels, statusTone } from "@/components/assessment/assignment-panel";
import type { GradingQueueItem } from "@/features/assessment/queries";

/**
 * One submission, with its grading form.
 *
 * The form posts a score, feedback and a status. It does not post who the
 * grader is or which course this belongs to — the action re-reads the
 * submission, re-checks course ownership, and clamps the score to the
 * assignment's own maximum. Nothing the form sends is trusted as authority.
 */
function GradingCard({ item }: { item: GradingQueueItem }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    gradeSubmissionAction,
    null,
  );

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusTone[item.status]}>{statusLabels[item.status]}</Badge>
        <span className="text-sm font-medium">{item.learnerName}</span>
        <span className="text-sm text-muted-foreground">{item.learnerEmail}</span>
        <span className="ml-auto text-sm text-muted-foreground" data-numeric>
          Attempt {item.attemptNumber}
          {item.submittedAt ? ` · ${new Date(item.submittedAt).toLocaleDateString()}` : ""}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold">{item.assignmentTitle}</p>
        <p className="text-sm text-muted-foreground">{item.courseTitle}</p>
      </div>

      <Separator />

      {item.submissionText ? (
        <div className="max-h-64 overflow-y-auto rounded-lg bg-muted p-3">
          <p className="text-sm whitespace-pre-line text-muted-foreground">{item.submissionText}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No written answer submitted.</p>
      )}

      {item.submissionUrl ? (
        <a
          href={item.submissionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          {item.submissionUrl}
        </a>
      ) : null}

      <Separator />

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="submissionId" value={item.submissionId} />

        {state?.message ? (
          <p
            className={cn("text-sm", state.ok ? "text-success" : "text-danger")}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field error={state?.fieldErrors?.score?.[0]}>
            <FieldLabel>Score</FieldLabel>
            <Input
              name="score"
              type="number"
              min={0}
              max={item.maxPoints}
              defaultValue={item.score ?? ""}
              placeholder={`0–${item.maxPoints}`}
              required
            />
          </Field>

          <Field>
            <FieldLabel>Outcome</FieldLabel>
            {/* Defaults to the current outcome so re-saving does not silently
                change it; a fresh submission defaults to approving. */}
            <Select
              name="status"
              defaultValue={item.status === "SUBMITTED" ? "APPROVED" : item.status}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">Approve</SelectItem>
                <SelectItem value="CHANGES_REQUESTED">Request changes</SelectItem>
                <SelectItem value="IN_REVIEW">Keep in review</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel>Feedback</FieldLabel>
          <Textarea
            name="feedback"
            rows={3}
            defaultValue={item.feedback ?? ""}
            placeholder="What was good, and what would make it better."
          />
        </Field>

        <Button type="submit" isLoading={pending} loadingText="Saving" className="self-start">
          Save grade
        </Button>
      </form>
    </Card>
  );
}

export { GradingCard };
