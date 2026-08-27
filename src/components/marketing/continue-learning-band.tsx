import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/primitives";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";

export interface ContinuingCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  categoryName: string;
  percent: number;
  completedLessons: number;
  totalLessons: number;
}

/**
 * "Pick up where you left off", on the marketing home page.
 *
 * A signed-in learner arriving at the root is almost never there to browse —
 * they are there to resume. Putting this above the catalogue answers the
 * question they actually came with, and it is skipped entirely for guests, who
 * would find an empty state more confusing than no section at all.
 *
 * Rendered as a single wide band rather than a grid: there is exactly one
 * "next thing", and giving it a row of its own is what makes it read as an
 * instruction rather than an option among many.
 */
function ContinueLearningBand({ course }: { course: ContinuingCourse }) {
  return (
    <Section spacing="sm" className="border-y border-border bg-primary-subtle/40">
      <Container>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Link
            href={routes.learn(course.slug)}
            className="w-full shrink-0 overflow-hidden rounded-xl border border-border sm:w-52"
            tabIndex={-1}
            aria-hidden="true"
          >
            <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
          </Link>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-mono text-2xs tracking-wide text-primary uppercase">
              Continue learning
            </span>

            <h2 className="truncate text-xl font-semibold tracking-tight">{course.title}</h2>

            <p className="truncate text-sm text-muted-foreground">
              <span data-numeric>{course.completedLessons}</span> of{" "}
              <span data-numeric>{course.totalLessons}</span> lessons complete
            </p>

            <div className="flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuenow={course.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${course.title} progress`}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out-quint"
                  style={{ width: `${course.percent}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-medium" data-numeric>
                {course.percent}%
              </span>
            </div>
          </div>

          <Button size="lg" className="shrink-0" asChild>
            <Link href={routes.learn(course.slug)}>
              <PlayCircle aria-hidden="true" />
              Resume
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}

export { ContinueLearningBand };
