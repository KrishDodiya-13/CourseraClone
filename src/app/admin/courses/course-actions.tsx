"use client";

import * as React from "react";
import { Archive, CircleCheck, CircleSlash, EllipsisVertical, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setCourseStatusAction } from "@/features/admin/actions";
import type { AdminCourseRow } from "@/features/admin/courses";

type Status = AdminCourseRow["status"];

/**
 * Moderation controls for one course.
 *
 * Publishing a course with unresolved metadata gaps asks for confirmation and
 * lists them, rather than blocking. The gaps are advisory judgements about
 * quality, and a rule that cannot be overridden becomes a rule that gets worked
 * around — an admin who knows better should be able to say so, once, out loud.
 *
 * Rejection requires a reason. The server enforces that too; here it just means
 * the instructor gets told what to fix.
 */
function CourseActions({ course }: { course: AdminCourseRow }) {
  const [pending, startTransition] = React.useTransition();
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function apply(status: Status, withReason?: string) {
    startTransition(async () => {
      const result = await setCourseStatusAction({
        courseId: course.id,
        status,
        reason: withReason,
      });
      if (result.ok) toast.success(result.message ?? "Saved");
      else toast.error(result.message ?? "That did not work");
    });
  }

  function publish() {
    if (course.readiness.length > 0) setPublishOpen(true);
    else apply("PUBLISHED");
  }

  const isPublished = course.status === "PUBLISHED";

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {course.status === "IN_REVIEW" ? (
          <>
            <Button size="sm" isLoading={pending} loadingText="Approving" onClick={publish}>
              <CircleCheck aria-hidden="true" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
          </>
        ) : isPublished ? (
          <Button
            size="sm"
            variant="outline"
            isLoading={pending}
            loadingText="Unpublishing"
            onClick={() => apply("DRAFT")}
          >
            <EyeOff aria-hidden="true" />
            Unpublish
          </Button>
        ) : (
          <Button size="sm" variant="outline" isLoading={pending} onClick={publish}>
            <Eye aria-hidden="true" />
            Publish
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${course.title}`}>
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>

            {course.status !== "DRAFT" ? (
              <DropdownMenuItem onSelect={() => apply("DRAFT")}>
                <EyeOff aria-hidden="true" />
                Draft
              </DropdownMenuItem>
            ) : null}

            {course.status !== "IN_REVIEW" ? (
              <DropdownMenuItem onSelect={() => apply("IN_REVIEW")}>
                <CircleCheck aria-hidden="true" />
                In review
              </DropdownMenuItem>
            ) : null}

            {course.status !== "REJECTED" ? (
              <DropdownMenuItem variant="danger" onSelect={() => setRejectOpen(true)}>
                <CircleSlash aria-hidden="true" />
                Rejected
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            {course.status !== "ARCHIVED" ? (
              <DropdownMenuItem onSelect={() => apply("ARCHIVED")}>
                <Archive aria-hidden="true" />
                Archive
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* --- reject, with a reason ----------------------------------------- */}
      <Modal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject “${course.title}”?`}
        description="The instructor sees this reason and can resubmit once they have addressed it."
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length === 0}
              onClick={() => {
                setRejectOpen(false);
                apply("REJECTED", reason.trim());
                setReason("");
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <label htmlFor={`reject-${course.id}`} className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">What needs to change?</span>
          <Textarea
            id={`reject-${course.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Be specific enough that the instructor can act on it."
            rows={4}
            maxLength={500}
          />
        </label>
      </Modal>

      {/* --- publish over metadata gaps ------------------------------------ */}
      <Modal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={`Publish “${course.title}” anyway?`}
        description="These are the things a learner will notice on the course page."
        footer={
          <>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPublishOpen(false);
                apply("PUBLISHED");
              }}
            >
              Publish anyway
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-1.5 text-sm">
          {course.readiness.map((gap) => (
            <li key={gap} className="flex items-center gap-2">
              <CircleSlash className="size-4 shrink-0 text-warning" aria-hidden="true" />
              {gap}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export { CourseActions };
