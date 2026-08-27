import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Download,
  GaugeCircle,
  Layers,
  MonitorPlay,
  Sparkles,
} from "lucide-react";

import { routes } from "@/lib/routes";
import {
  getCategories,
  getFeaturedCourses,
  getPopularInstructors,
  getRecentTestimonials,
  getTopRatedCourses,
  getRecentCourses,
  getTrendingCourses,
} from "@/features/catalog/queries";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, Grid, Section, Stack } from "@/components/layout/primitives";
import { CourseCard } from "@/components/catalog/course-card";
import { CategoryCard } from "@/components/catalog/category-card";
import { InstructorCard } from "@/components/catalog/instructor-card";
import { TestimonialCard } from "@/components/marketing/testimonial-card";
import { SectionHeading } from "@/components/marketing/section-heading";
import { HomeHero } from "@/components/marketing/home-hero";
import { ContinueLearningBand } from "@/components/marketing/continue-learning-band";
import { getSessionUser } from "@/server/authz";
import { getContinueLearning } from "@/features/dashboard/queries";

/**
 * Aggregate figures shown as social proof.
 *
 * Derived from the catalogue rather than typed in, so they can never drift
 * from the data on the page. Phase 5 swaps the source for a query; the
 * derivation stays.
 */

const benefits = [
  {
    icon: Layers,
    title: "Structure over volume",
    body: "Every course is built as sections and lessons with a deliberate path through them — not an undifferentiated pile of videos you are left to sequence yourself.",
  },
  {
    icon: GaugeCircle,
    title: "Progress that follows you",
    body: "Each lesson records where you stopped, to the second. Close a laptop mid-sentence and pick up on a phone exactly where you left off.",
  },
  {
    icon: Download,
    title: "Works without a connection",
    body: "Download articles, diagrams and quizzes for a commute. Your progress queues locally and syncs the moment you are back online.",
  },
  {
    icon: BadgeCheck,
    title: "Credentials worth showing",
    body: "Finish a course and get a certificate carrying a public verification code, so anyone can confirm it without needing an account of their own.",
  },
  {
    icon: MonitorPlay,
    title: "Taught by people who do the work",
    body: "Instructors are practitioners, and every course is reviewed before it reaches the catalogue. Nothing is published on reputation alone.",
  },
  {
    icon: Sparkles,
    title: "Momentum you can see",
    body: "Streaks, badges and honest completion tracking — designed to show real progress rather than to manufacture anxiety about missing a day.",
  },
];

export default async function HomePage() {
  const [
    categories,
    featuredCourses,
    trending,
    topRated,
    recent,
    instructors,
    testimonials,
    viewer,
  ] = await Promise.all([
    getCategories(),
    getFeaturedCourses(8),
    getTrendingCourses(8),
    getTopRatedCourses(8),
    getRecentCourses(8),
    getPopularInstructors(4),
    getRecentTestimonials(4),
    getSessionUser(),
  ]);

  // Only asked for when someone is signed in — a guest has nothing to continue.
  const continuing = viewer ? await getContinueLearning(viewer.id) : null;

  // Aggregates derived from the catalogue rather than typed in, so the social
  // proof on this page can never disagree with the data behind it.
  const totalLearners = instructors.reduce((sum, item) => sum + item.studentCount, 0);
  const totalCourses = categories.reduce((sum, item) => sum + item.courseCount, 0);

  return (
    <>
      <HomeHero
        course={featuredCourses[0] ?? null}
        totalCourses={totalCourses}
        totalLearners={totalLearners}
        categoryCount={categories.length}
      />

      {/* ================= CONTINUE LEARNING ============================ */}
      {continuing ? (
        <ContinueLearningBand
          course={{
            id: continuing.courseId,
            slug: continuing.slug,
            title: continuing.title,
            thumbnailUrl: continuing.thumbnailUrl,
            categoryName: continuing.categoryName,
            percent: continuing.percent,
            completedLessons: continuing.completedLessons,
            totalLessons: continuing.totalLessons,
          }}
        />
      ) : null}

      {/* ================= POPULAR CATEGORIES =========================== */}
      <Section spacing="md" className="border-t border-border">
        <Container>
          <Stack gap={8}>
            <SectionHeading
              eyebrow="Explore"
              title="Popular categories"
              description="Six fields with the deepest catalogues. Every course inside is reviewed before it is published."
              action={
                <Button variant="outline" asChild>
                  <Link href={routes.categories}>
                    All categories
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
            <Grid cols={3} gap={5}>
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= TRENDING COURSES ============================= */}
      <Section spacing="md" className="bg-muted/40">
        <Container>
          <Stack gap={8}>
            <SectionHeading
              eyebrow="Featured"
              title="Featured courses"
              description="Hand-picked for depth over breadth — each one leaves you able to do something you could not do before."
              action={
                <Button variant="outline" asChild>
                  <Link href={routes.courses}>
                    View all courses
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
            <Grid cols={4} gap={5}>
              {featuredCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= TRENDING ===================================== */}
      <Section spacing="md" className="border-t border-border">
        <Container>
          <Stack gap={8}>
            <SectionHeading
              eyebrow="Moving now"
              title="Trending this month"
              description="What learners are enrolling in most, outside the permanent bestsellers."
              action={
                <Button variant="outline" asChild>
                  <Link href={`${routes.courses}?sort=popular`}>
                    See popular
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
            <Grid cols={4} gap={5}>
              {trending.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= TOP RATED ==================================== */}
      <Section spacing="md" className="bg-muted/40">
        <Container>
          <Stack gap={8}>
            <SectionHeading
              eyebrow="Best reviewed"
              title="Top rated"
              description="Highest rated courses with enough reviews for the average to mean something."
              action={
                <Button variant="outline" asChild>
                  <Link href={`${routes.courses}?sort=rating`}>
                    Sort by rating
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
            <Grid cols={4} gap={5}>
              {topRated.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= RECENTLY ADDED =============================== */}
      <Section spacing="md">
        <Container>
          <Stack gap={8}>
            <SectionHeading
              eyebrow="New"
              title="Recently added"
              description="The latest courses to clear review and reach the catalogue."
              action={
                <Button variant="outline" asChild>
                  <Link href={`${routes.courses}?sort=newest`}>
                    See what is new
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
            <Grid cols={4} gap={5}>
              {recent.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= POPULAR INSTRUCTORS ========================== */}
      <Section spacing="md">
        <Container>
          <Stack gap={8}>
            <SectionHeading
              eyebrow="Who teaches here"
              title="Practitioners, not personalities"
              description="Every instructor still does the work they teach. Ratings are from verified enrolments only."
              action={
                <Button variant="outline" asChild>
                  <Link href={routes.instructors}>
                    All instructors
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            />
            <Grid cols={4} gap={5}>
              {instructors.map((instructor) => (
                <InstructorCard key={instructor.id} instructor={instructor} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= LEARNING BENEFITS ============================ */}
      <Section spacing="md" className="border-y border-border bg-muted/40">
        <Container>
          <Stack gap={10}>
            <SectionHeading
              eyebrow="Why Coursera"
              title="Built around finishing, not enrolling"
              description="Most platforms optimise for the moment you sign up. These are the decisions we made for the weeks after that."
              align="center"
            />
            <Grid cols={3} gap={5}>
              {benefits.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="flex flex-col gap-3 p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-primary-subtle-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </Card>
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= TESTIMONIALS ================================= */}
      <Section spacing="md">
        <Container>
          <Stack gap={10}>
            <SectionHeading
              eyebrow="From learners"
              title="What people say after they finish"
              description="Reviews come from verified enrolments, and we publish the middling ones too."
              align="center"
            />
            <Grid cols={2} gap={5} className="lg:grid-cols-4">
              {testimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </Grid>
          </Stack>
        </Container>
      </Section>

      {/* ================= CLOSING CTA ================================== */}
      <Section spacing="md">
        <Container>
          <Card
            variant="elevated"
            className="relative overflow-hidden border-primary/20 p-8 sm:p-12"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,var(--color-primary-subtle),transparent)]"
            />
            <div className="relative flex flex-col items-center gap-6 text-center">
              <Stack gap={3} align="center">
                <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">
                  Pick one course. Actually finish it.
                </h2>
                <p className="max-w-xl text-base text-muted-foreground">
                  Start with a free course today — no card, no trial countdown. Upgrade only if you
                  want a certificate at the end.
                </p>
              </Stack>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href={routes.register}>
                    Create a free account
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href={routes.becomeInstructor}>Teach on Coursera</Link>
                </Button>
              </div>
            </div>
          </Card>
        </Container>
      </Section>
    </>
  );
}
