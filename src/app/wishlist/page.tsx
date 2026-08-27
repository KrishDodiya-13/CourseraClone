import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Heart, PlayCircle } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatCoursePrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { RatingStars } from "@/components/catalog/rating-stars";
import { WishlistButton } from "@/components/catalog/wishlist-button";
import { getWishlist } from "@/features/wishlist/queries";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

/**
 * Saved courses.
 *
 * `getWishlist` calls `requireAuth`, so this page is protected at the data
 * layer rather than relying on the middleware redirect.
 */
export default async function WishlistPage() {
  const items = await getWishlist();

  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={8}>
          <PageHeader
            eyebrow="Saved"
            title="Your wishlist"
            description={
              items.length === 0
                ? "Courses you save are kept here, on every device you sign in from."
                : `${items.length} ${items.length === 1 ? "course" : "courses"} saved for later.`
            }
            actions={
              items.length > 0 ? (
                <Button variant="outline" asChild>
                  <Link href={routes.courses}>
                    <Compass aria-hidden="true" />
                    Browse more
                  </Link>
                </Button>
              ) : null
            }
          />

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
                <Card key={course.id} className="overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row">
                    <Link
                      href={routes.course(course.slug)}
                      className="w-full shrink-0 overflow-hidden rounded-lg sm:w-52"
                    >
                      <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
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

                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {course.subtitle}
                      </p>

                      <p className="text-sm text-muted-foreground">{course.instructor.name}</p>

                      <RatingStars rating={course.ratingAvg} count={course.ratingCount} />
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                      <span className="font-display text-xl font-semibold" data-numeric>
                        {formatCoursePrice(course.priceAmount, course.currency)}
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {isEnrolled ? (
                          <Button size="sm" asChild>
                            <Link href={routes.learn(course.slug)}>
                              <PlayCircle aria-hidden="true" />
                              Continue
                            </Link>
                          </Button>
                        ) : (
                          <Button size="sm" asChild>
                            <Link href={routes.course(course.slug)}>View course</Link>
                          </Button>
                        )}

                        {/*
                          Removing from here revalidates this page, so the row
                          disappears rather than lingering until a manual reload.
                        */}
                        <WishlistButton
                          courseId={course.id}
                          courseTitle={course.title}
                          initialWishlisted
                          revalidatePath={routes.wishlist}
                          variant="inline"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
