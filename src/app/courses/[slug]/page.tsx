import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Check, Clock3, Globe, PlayCircle, Signal, Users } from "lucide-react";

import { routes } from "@/lib/routes";
import {
  discountPercent,
  formatCompact,
  formatCoursePrice,
  formatDuration,
  formatPrice,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/avatar";
import { Container, Grid, Inline, Section, Stack } from "@/components/layout/primitives";
import { RatingStars } from "@/components/catalog/rating-stars";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { CourseCard } from "@/components/catalog/course-card";
import { Curriculum } from "@/components/catalog/curriculum";
import { WishlistButton } from "@/components/catalog/wishlist-button";
import { getCourseBySlug, getRelatedCourses } from "@/features/catalog/queries";
import { getCourseViewerState } from "@/features/enrollment/queries";
import { EnrollCta } from "@/components/catalog/enroll-cta";
import { courseLevelLabels } from "@/features/catalog/types";
import { LANGUAGE_LABELS } from "@/features/catalog/search-params";

/**
 * Deliberately not prerendered with `generateStaticParams`.
 *
 * Courses are published, repriced and re-rated continuously, so the set of
 * valid slugs is not knowable at build time. Prerendering it also broke the
 * not-found path: an unknown slug was generated on demand and the `notFound()`
 * result was cached and served with a 200, which tells a crawler a missing
 * course is a real page.
 *
 * Cached for five minutes instead, which keeps detail pages cheap without
 * pinning the slug set to the last deploy.
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);

  // Deliberately NOT calling notFound() here. Throwing it from
  // generateMetadata renders the not-found page but leaves the status at 200,
  // because metadata resolves after the response has been committed. The page
  // body below is the only place that produces a real 404, and the lookup is
  // memoised with React `cache` so the second call costs nothing.
  if (!course) return { title: "Course not found" };

  return {
    title: course.title,
    description: course.subtitle,
    openGraph: { title: course.title, description: course.subtitle, type: "website" },
  };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);

  // A draft or archived course is indistinguishable from one that never
  // existed — the query filters on PUBLISHED, so this covers both.
  if (!course) notFound();

  const [related, viewerState] = await Promise.all([
    getRelatedCourses(course.id, course.category.slug),
    getCourseViewerState(course.id),
  ]);
  const discount =
    course.compareAtAmount === null
      ? 0
      : discountPercent(course.priceAmount, course.compareAtAmount);

  const previewCount = course.sections.reduce(
    (sum, section) => sum + section.lessons.filter((lesson) => lesson.isFreePreview).length,
    0,
  );

  const facts = [
    { icon: Signal, label: courseLevelLabels[course.level] },
    { icon: PlayCircle, label: `${course.lessonCount} lessons` },
    { icon: Clock3, label: formatDuration(course.durationMinutes) },
    { icon: Globe, label: LANGUAGE_LABELS[course.language] ?? course.language.toUpperCase() },
    { icon: Users, label: `${formatCompact(course.enrollmentCount)} learners` },
  ];

  return (
    <>
      {/* ================= HERO ======================================== */}
      <Section spacing="md" className="border-b border-border bg-muted/40">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Stack gap={5}>
              <Inline gap={2}>
                <Badge variant="primary" asChild>
                  <Link href={routes.category(course.category.slug)}>{course.category.name}</Link>
                </Badge>
                {course.isBestseller ? <Badge variant="accent">Bestseller</Badge> : null}
                {course.priceAmount === 0 ? <Badge variant="success">Free</Badge> : null}
              </Inline>

              <Stack gap={3}>
                <h1 className="text-3xl font-semibold sm:text-4xl">{course.title}</h1>
                <p className="max-w-2xl text-lg text-muted-foreground">{course.subtitle}</p>
              </Stack>

              <Inline gap={4}>
                <RatingStars rating={course.ratingAvg} count={course.ratingCount} size="md" />
              </Inline>

              {course.instructorProfile ? (
                <Inline gap={2}>
                  <UserAvatar
                    name={course.instructorProfile.name}
                    src={course.instructorProfile.avatarUrl}
                    size="sm"
                  />
                  <span className="text-sm text-muted-foreground">
                    Taught by{" "}
                    <Link
                      href={routes.instructor(course.instructorProfile.slug)}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {course.instructorProfile.name}
                    </Link>
                  </span>
                </Inline>
              ) : null}

              <Inline gap={4} className="text-sm text-muted-foreground">
                {facts.map((fact) => (
                  <span key={fact.label} className="inline-flex items-center gap-1.5">
                    <fact.icon className="size-4" aria-hidden="true" />
                    {fact.label}
                  </span>
                ))}
              </Inline>

              {course.tags.length > 0 ? (
                <Inline gap={2}>
                  {course.tags.map((tag, index) => (
                    <Badge key={tag} variant="outline" size="sm" asChild>
                      <Link href={`${routes.courses}?tag=${course.tagSlugs[index]}`}>{tag}</Link>
                    </Badge>
                  ))}
                </Inline>
              ) : null}
            </Stack>

            {/* --- purchase card --- */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <Card variant="elevated" className="overflow-hidden">
                <div className="relative">
                  <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
                  <div className="absolute top-2.5 right-2.5">
                    <WishlistButton
                      courseId={course.id}
                      courseTitle={course.title}
                      initialWishlisted={viewerState.isWishlisted}
                    />
                  </div>
                </div>

                <CardContent className="flex flex-col gap-4 p-5 pt-5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-3xl font-semibold" data-numeric>
                      {formatCoursePrice(course.priceAmount, course.currency)}
                    </span>
                    {course.compareAtAmount ? (
                      <>
                        <span className="text-base text-muted-foreground line-through" data-numeric>
                          {formatPrice(course.compareAtAmount, course.currency)}
                        </span>
                        {discount > 0 ? <Badge variant="danger">{discount}% off</Badge> : null}
                      </>
                    ) : null}
                  </div>

                  <EnrollCta
                    courseId={course.id}
                    courseSlug={course.slug}
                    priceAmount={course.priceAmount}
                    state={viewerState}
                  />

                  {previewCount > 0 ? (
                    <p className="text-center text-sm text-muted-foreground" data-numeric>
                      {previewCount} {previewCount === 1 ? "lesson" : "lessons"} free to preview
                    </p>
                  ) : null}

                  <Separator />

                  <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <BadgeCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                      Certificate on completion
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock3 className="size-4 shrink-0 text-success" aria-hidden="true" />
                      Lifetime access
                    </li>
                    <li className="flex items-center gap-2">
                      <Signal className="size-4 shrink-0 text-success" aria-hidden="true" />
                      Progress synced across devices
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </Container>
      </Section>

      {/* ================= BODY ======================================== */}
      <Section spacing="md">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Stack gap={10}>
              {course.learningObjectives.length > 0 ? (
                <Stack gap={3}>
                  <h2 className="text-2xl font-semibold">What you will learn</h2>
                  <Card className="p-6">
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {course.learningObjectives.map((objective) => (
                        <li key={objective} className="flex gap-2.5 text-sm">
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span className="text-muted-foreground">{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </Stack>
              ) : null}

              <Stack gap={3}>
                <h2 className="text-2xl font-semibold">Prerequisites</h2>
                {course.prerequisites.length === 0 ? (
                  <p className="text-base text-muted-foreground">
                    None. This course starts from the beginning.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {course.prerequisites.map((prerequisite) => (
                      <li key={prerequisite} className="flex gap-2.5 text-sm">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                        />
                        <span className="text-muted-foreground">{prerequisite}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Stack>

              <Stack gap={3}>
                <h2 className="text-2xl font-semibold">About this course</h2>
                <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                  {course.description}
                </p>
              </Stack>

              <Stack gap={3}>
                <h2 className="text-2xl font-semibold">Curriculum</h2>
                <Curriculum sections={course.sections} />
              </Stack>

              {course.instructorProfile ? (
                <Stack gap={3}>
                  <h2 className="text-2xl font-semibold">Your instructor</h2>
                  <Card className="p-6">
                    <Stack gap={4}>
                      <Inline gap={4} wrap={false}>
                        <UserAvatar
                          name={course.instructorProfile.name}
                          src={course.instructorProfile.avatarUrl}
                          size="lg"
                        />
                        <Stack gap={1}>
                          <Link
                            href={routes.instructor(course.instructorProfile.slug)}
                            className="text-lg font-semibold hover:text-primary"
                          >
                            {course.instructorProfile.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {course.instructorProfile.headline}
                          </p>
                        </Stack>
                      </Inline>

                      <Inline gap={5} className="text-sm text-muted-foreground">
                        <span data-numeric>
                          <strong className="text-foreground">
                            {formatCompact(course.instructorProfile.studentCount)}
                          </strong>{" "}
                          learners
                        </span>
                        <span data-numeric>
                          <strong className="text-foreground">
                            {course.instructorProfile.courseCount}
                          </strong>{" "}
                          courses
                        </span>
                        <RatingStars rating={course.instructorProfile.ratingAvg} />
                      </Inline>

                      {course.instructorProfile.bio ? (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {course.instructorProfile.bio}
                        </p>
                      ) : null}
                    </Stack>
                  </Card>
                </Stack>
              ) : null}

              <Stack gap={3}>
                <h2 className="text-2xl font-semibold">
                  Reviews
                  {course.ratingCount > 0 ? (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      ({course.ratingCount})
                    </span>
                  ) : null}
                </h2>

                {course.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reviews yet. Reviews come from verified enrolments only.
                  </p>
                ) : (
                  <Stack gap={4}>
                    {course.reviews.map((review) => (
                      <Card key={review.id} className="p-5">
                        <Stack gap={3}>
                          <Inline gap={3} wrap={false}>
                            <UserAvatar
                              name={review.authorName}
                              src={review.authorAvatarUrl}
                              size="sm"
                            />
                            <Stack gap={0}>
                              <span className="text-sm font-medium">{review.authorName}</span>
                              <RatingStars rating={review.rating} size="sm" />
                            </Stack>
                          </Inline>
                          {review.title ? (
                            <p className="text-sm font-semibold">{review.title}</p>
                          ) : null}
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {review.body}
                          </p>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Stack>

            <div aria-hidden="true" className="hidden lg:block" />
          </div>
        </Container>
      </Section>

      {/* ================= RELATED ===================================== */}
      {related.length > 0 ? (
        <Section spacing="md" className="border-t border-border bg-muted/40">
          <Container>
            <Stack gap={6}>
              <h2 className="text-2xl font-semibold">More in {course.category.name}</h2>
              <Grid cols={3} gap={5}>
                {related.map((item) => (
                  <CourseCard key={item.id} course={item} />
                ))}
              </Grid>
            </Stack>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
