import Link from "next/link";
import { Clock3, PlayCircle, Signal, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { formatCompact, formatDuration } from "@/lib/format";
import { discountPercent, formatCoursePrice } from "@/lib/currency";
import { courseLevelLabels, type CourseSummary } from "@/features/catalog/types";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { RatingStars } from "@/components/catalog/rating-stars";
import { WishlistButton } from "@/components/catalog/wishlist-button";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";

/**
 * The catalogue's primary unit.
 *
 * Hierarchy is deliberate and top-down: artwork, then title, then the numbers
 * that decide a purchase, then price. The thumbnail is the largest element on
 * the card because it is the only part a scanning eye lands on first, and the
 * price sits alone on the bottom rule so a row of cards compares down a column
 * rather than across a jumble.
 *
 * Accessibility note: the card is deliberately *not* wrapped in a link. The
 * title carries the link and stretches its hit area over the whole card via
 * `after:absolute`, which leaves the wishlist button as a sibling rather than
 * a control nested inside an anchor.
 */
function CourseCard({
  course,
  className,
  isWishlisted = false,
}: {
  course: CourseSummary;
  className?: string;
  /** Resolved server-side so the heart is correct on first paint. */
  isWishlisted?: boolean;
}) {
  const discount = discountPercent(course.priceAmount, course.compareAtAmount);
  const isFree = course.priceAmount === 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out-quint",
        "hover:-translate-y-0.5 hover:border-border/60 hover:shadow-lg",
        "focus-within:-translate-y-0.5 focus-within:shadow-lg",
        "motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    >
      {/* --- artwork: the dominant element -------------------------------- */}
      <div className="relative overflow-hidden">
        <div className="transition-transform duration-300 ease-out-quint group-hover:scale-[1.03] motion-reduce:transform-none">
          <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
        </div>

        {/* A scrim, not a gradient decoration — it exists so the overlaid
            duration stays legible over artwork of unknown brightness. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent"
        />

        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {course.isBestseller ? (
            <Badge variant="accent" size="sm">
              Bestseller
            </Badge>
          ) : null}
          {isFree ? (
            <Badge variant="success" size="sm">
              Free
            </Badge>
          ) : discount > 0 ? (
            <Badge variant="danger" size="sm">
              {discount}% off
            </Badge>
          ) : null}
        </div>

        {/* Sits above the stretched title link so it stays independently clickable. */}
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton
            courseId={course.id}
            courseTitle={course.title}
            initialWishlisted={isWishlisted}
          />
        </div>

        <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2.5 text-2xs font-medium text-white">
          <span className="inline-flex items-center gap-1" data-numeric>
            <PlayCircle className="size-3.5" aria-hidden="true" />
            {course.lessonCount}
          </span>
          <span className="inline-flex items-center gap-1" data-numeric>
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDuration(course.durationMinutes)}
          </span>
        </div>
      </div>

      {/* --- body ---------------------------------------------------------- */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center gap-2 text-2xs">
          <span className="font-medium tracking-wide text-primary uppercase">
            {course.category.name}
          </span>
          <span aria-hidden="true" className="size-0.5 rounded-full bg-border" />
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Signal className="size-3" aria-hidden="true" />
            {courseLevelLabels[course.level]}
          </span>
        </div>

        <h3 className="line-clamp-2 text-base leading-snug font-semibold tracking-tight">
          <Link
            href={routes.course(course.slug)}
            className="after:absolute after:inset-0 after:content-[''] hover:text-primary"
          >
            {course.title}
          </Link>
        </h3>

        <div className="flex items-center gap-2">
          <UserAvatar name={course.instructor.name} src={course.instructor.avatarUrl} size="xs" />
          <span className="truncate text-sm text-muted-foreground">{course.instructor.name}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RatingStars rating={course.ratingAvg} count={course.ratingCount} />
          <span
            className="inline-flex items-center gap-1 text-sm text-muted-foreground"
            data-numeric
          >
            <Users className="size-3.5" aria-hidden="true" />
            {formatCompact(course.enrollmentCount)}
          </span>
        </div>

        {/* Pushed to the bottom and given its own rule, so prices align across
            a row of cards whatever the title length above them. */}
        <div className="mt-auto flex items-baseline gap-2 border-t border-border/70 pt-3">
          <span className="font-display text-xl font-semibold tracking-tight" data-numeric>
            {formatCoursePrice(course.priceAmount, course.currency)}
          </span>
          {course.compareAtAmount !== null && discount > 0 ? (
            <span className="text-sm text-muted-foreground line-through" data-numeric>
              {formatCoursePrice(course.compareAtAmount, course.currency)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export { CourseCard };
