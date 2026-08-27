import Link from "next/link";
import { ArrowRight, BadgeCheck, CirclePlay, Download, Star } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatCompact } from "@/lib/format";
import { formatCoursePrice } from "@/lib/currency";
import type { CourseSummary } from "@/features/catalog/types";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/primitives";
import { Reveal } from "@/components/layout/reveal";
import { SearchBar } from "@/components/catalog/search-bar";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { UserAvatar } from "@/components/ui/avatar";

/**
 * The hero.
 *
 * Asymmetric on purpose. A centred column of headline-subhead-buttons is the
 * house style of every SaaS landing page, and it says nothing about what this
 * product is. Putting a real course beside the copy makes the subject legible
 * before a word is read — the page is about learning, and the proof is the
 * artwork, the rating and the price of something you could actually enrol in.
 *
 * The card on the right is a real row from the catalogue, not an illustration.
 * Nothing here is mocked.
 */
function HomeHero({
  course,
  totalCourses,
  totalLearners,
  categoryCount,
}: {
  /** The course to showcase. Null when the catalogue is empty. */
  course: CourseSummary | null;
  totalCourses: number;
  totalLearners: number;
  categoryCount: number;
}) {
  return (
    <Section spacing="lg" className="relative overflow-hidden">
      {/* A single wash anchored behind the copy, not a full-bleed gradient
          background. It gives the fold depth without tinting the whole page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 size-[38rem] rounded-full bg-[radial-gradient(circle,var(--color-primary-subtle),transparent_68%)] opacity-70 blur-2xl"
      />

      <Container className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* --- copy ---------------------------------------------------- */}
          <div className="flex flex-col items-start gap-6">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-2xs font-medium">
                <span className="flex size-1.5 rounded-full bg-success" aria-hidden="true" />
                <span data-numeric>{totalCourses}</span> courses across{" "}
                <span data-numeric>{categoryCount}</span> fields
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="max-w-xl text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
                Learn something that{" "}
                <span className="relative whitespace-nowrap text-primary">
                  actually sticks
                  {/* An underline drawn as a shape, so it survives a line break
                      and does not inherit the descender clipping of text-decoration. */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 300 12"
                    preserveAspectRatio="none"
                    className="absolute inset-x-0 -bottom-1 h-2.5 w-full text-primary/25"
                  >
                    <path
                      d="M2 8.5C60 3.5 120 2.5 180 4.5C220 5.8 260 7.5 298 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                .
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="max-w-lg text-lg text-muted-foreground">
                Structured courses taught by practitioners, progress that follows you between
                devices, and certificates anyone can verify. Built for people who intend to finish.
              </p>
            </Reveal>

            <Reveal delay={0.15} className="w-full">
              <div className="w-full max-w-lg">
                <SearchBar size="lg" id="hero-search" />
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" asChild>
                  <Link href={routes.register}>
                    Start learning free
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href={routes.courses}>Browse the catalogue</Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={0.25}>
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <li className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
                  Verifiable certificates
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Download className="size-4 text-primary" aria-hidden="true" />
                  Works offline
                </li>
                <li className="inline-flex items-center gap-1.5" data-numeric>
                  <Star className="size-4 text-accent" aria-hidden="true" />
                  {formatCompact(totalLearners)} learners
                </li>
              </ul>
            </Reveal>
          </div>

          {/* --- showcase ------------------------------------------------- */}
          {course ? (
            <Reveal delay={0.16} className="hidden lg:block">
              <div className="relative">
                {/* Two stacked plates behind the card imply a catalogue rather
                    than a single item, at almost no rendering cost. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-6 -top-4 h-full rounded-2xl border border-border bg-card/50"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-3 -top-2 h-full rounded-2xl border border-border bg-card/75"
                />

                <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                  <div className="relative">
                    <CourseThumbnail title={course.title} src={course.thumbnailUrl} />
                    <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-2xs font-medium shadow-sm">
                      <CirclePlay className="size-3.5 text-primary" aria-hidden="true" />
                      <span data-numeric>{course.lessonCount}</span> lessons
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-5">
                    <span className="text-2xs font-medium tracking-wide text-primary uppercase">
                      {course.category.name}
                    </span>
                    <h2 className="text-lg leading-snug font-semibold">
                      <Link href={routes.course(course.slug)} className="hover:text-primary">
                        {course.title}
                      </Link>
                    </h2>

                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={course.instructor.name}
                        src={course.instructor.avatarUrl}
                        size="xs"
                      />
                      <span className="text-sm text-muted-foreground">
                        {course.instructor.name}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between border-t border-border pt-3">
                      <span className="inline-flex items-baseline gap-1.5 text-sm">
                        <Star
                          className="size-3.5 self-center fill-accent text-accent"
                          aria-hidden="true"
                        />
                        <span className="font-semibold" data-numeric>
                          {course.ratingAvg.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground" data-numeric>
                          ({formatCompact(course.ratingCount)})
                        </span>
                      </span>
                      <span className="font-display text-xl font-semibold" data-numeric>
                        {formatCoursePrice(course.priceAmount, course.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}

export { HomeHero };
