import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Heart, PlayCircle } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatCoursePrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { RatingStars } from "@/components/catalog/rating-stars";
import { WishlistButton } from "@/components/catalog/wishlist-button";
import { SectionHeading } from "@/components/dashboard/stat-tile";
import { getWishlist } from "@/features/wishlist/queries";

export const metadata: Metadata = { title: "Wishlist" };

/**
 * Saved courses, inside the dashboard.
 *
 * Shares `getWishlist` with the standalone /wishlist route rather than
 * duplicating the query — the two views differ in chrome, not in data.
 */
export default async function DashboardWishlistPage() {
  const items = await getWishlist();

  return (
    <Stack gap={6}>
      <SectionHeading
        title="Wishlist"
        action={
          items.length > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={routes.courses}>
                <Compass aria-hidden="true" />
                Browse more
              </Link>
            </Button>
          ) : null
        }
      >
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? "Saved courses are kept on every device you sign in from."
            : `${items.length} saved for later.`}
        </p>
      </SectionHeading>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart aria-hidden="true" />}
          title="Nothing saved yet"
          description="Tap the heart on any course to keep it here while you decide."
          size="lg"
          actions={
            <Button asChild>
              <Link href={routes.courses}>Browse the catalogue</Link>
            </Button>
          }
        />
      ) : (
        <Stack gap={4}>
          {items.map(({ course, isEnrolled }) => (
            <Card key={course.id} className="flex flex-col gap-4 p-4 sm:flex-row">
              <Link
                href={routes.course(course.slug)}
                className="w-full shrink-0 overflow-hidden rounded-lg sm:w-44"
              >
                <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="primary" size="sm">
                    {course.category.name}
                  </Badge>
                  {isEnrolled ? (
                    <Badge variant="success" size="sm">
                      Enrolled
                    </Badge>
                  ) : null}
                </div>
                <Link
                  href={routes.course(course.slug)}
                  className="text-base font-semibold hover:text-primary"
                >
                  {course.title}
                </Link>
                <p className="line-clamp-2 text-sm text-muted-foreground">{course.subtitle}</p>
                <RatingStars rating={course.ratingAvg} count={course.ratingCount} />
              </div>

              <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                <span className="font-display text-xl font-semibold" data-numeric>
                  {formatCoursePrice(course.priceAmount, course.currency)}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link
                      href={isEnrolled ? routes.learn(course.slug) : routes.course(course.slug)}
                    >
                      {isEnrolled ? (
                        <>
                          <PlayCircle aria-hidden="true" />
                          Continue
                        </>
                      ) : (
                        "View course"
                      )}
                    </Link>
                  </Button>
                  <WishlistButton
                    courseId={course.id}
                    courseTitle={course.title}
                    initialWishlisted
                    revalidatePath={routes.dashboardWishlist}
                    variant="inline"
                  />
                </div>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
