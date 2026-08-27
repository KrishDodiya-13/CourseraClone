import Link from "next/link";
import { ArrowRight, CircleCheck, PlayCircle } from "lucide-react";

import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { enrollAndRedirectAction } from "@/features/enrollment/actions";
import type { CourseViewerState } from "@/features/enrollment/queries";

/**
 * The course page's primary call to action.
 *
 * Four states, decided entirely on the server:
 *
 *   enrolled       → Continue learning (with progress)
 *   teaches it     → Open in studio, never "buy your own course"
 *   free           → Enrol directly, via a real form POST
 *   paid           → Hand off to checkout
 *
 * The free branch is a plain `<form action={...}>` rather than an onClick, so
 * enrolling works with JavaScript disabled and cannot be triggered by a
 * prefetch. The action re-derives everything — price, publish status,
 * existing enrolment — because none of the props below are trustworthy.
 */
function EnrollCta({
  courseId,
  courseSlug,
  priceAmount,
  state,
  size = "lg",
}: {
  courseId: string;
  courseSlug: string;
  priceAmount: number;
  state: CourseViewerState;
  size?: "md" | "lg";
}) {
  if (state.isEnrolled) {
    return (
      <div className="flex flex-col gap-2">
        <Button size={size} fullWidth asChild>
          <Link href={routes.learn(courseSlug)}>
            <PlayCircle aria-hidden="true" />
            {state.progressPercent > 0 ? "Continue learning" : "Start learning"}
          </Link>
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
          You are enrolled
          {state.progressPercent > 0 ? (
            <span data-numeric>· {state.progressPercent}% complete</span>
          ) : null}
        </p>
      </div>
    );
  }

  if (state.isInstructor) {
    return (
      <div className="flex flex-col gap-2">
        <Button size={size} variant="outline" fullWidth asChild>
          <Link href={routes.studio}>
            Open in studio
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Badge variant="accent" size="sm">
            You teach this course
          </Badge>
        </p>
      </div>
    );
  }

  if (priceAmount > 0) {
    return (
      <Button size={size} fullWidth asChild>
        <Link href={routes.checkoutFor(courseSlug)}>
          Get this course
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  return (
    <form action={enrollAndRedirectAction}>
      <input type="hidden" name="courseId" value={courseId} />
      <Button type="submit" size={size} fullWidth>
        Enrol for free
        <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}

export { EnrollCta };
