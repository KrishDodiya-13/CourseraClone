import { BLUEPRINTS, type Blueprint } from "./blueprints";
import { BLUEPRINTS_EXTRA } from "./blueprints-extra";
import { CLIENT_COURSES } from "./client-courses";
import { INSTRUCTORS } from "./taxonomy";
import { artworkFor } from "./artwork";

/**
 * Catalogue generator.
 *
 * Expands each blueprint into a full course — curriculum, pricing, ratings,
 * enrolment counts — **deterministically**. Every random-looking value is
 * derived from a hash of the course slug, so the same blueprint always produces
 * the same course, on any machine, on every run. That is what makes re-seeding
 * safe: the catalogue is a pure function of this file plus the blueprints, not
 * a fresh roll of the dice each time.
 *
 * Nothing here uses `Math.random()`. A seed that produces different data every
 * run makes every screenshot, test fixture and bug report unreproducible.
 */

/* -------------------------------------------------------------------------- */
/*  Deterministic randomness                                                  */
/* -------------------------------------------------------------------------- */

/** FNV-1a. Small, fast, and good enough to decorrelate the fields below. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A tiny seeded generator.
 *
 * `mulberry32` is used rather than a hand-rolled LCG because a weak generator
 * correlates successive draws, and this file draws a dozen values per course —
 * correlated draws would show up as, say, every advanced course also being the
 * most expensive.
 */
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max]. */
function intBetween(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

function pick<T>(next: () => number, list: readonly T[]): T {
  const value = list[Math.floor(next() * list.length)];
  if (value === undefined) throw new Error("pick from an empty list");
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Pricing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Indian price points, in paise.
 *
 * Real price points rather than a continuous range: nothing is sold at ₹2,137.
 * Level shifts the band, so an advanced course is not priced like an
 * introduction, but the bands overlap so price does not become a proxy for
 * difficulty.
 */
const PRICE_BANDS: Record<Blueprint["level"], number[]> = {
  BEGINNER: [49900, 79900, 99900, 149900, 199900],
  ALL_LEVELS: [79900, 99900, 149900, 199900, 249900],
  INTERMEDIATE: [149900, 199900, 249900, 299900, 349900],
  ADVANCED: [249900, 299900, 349900, 499900, 599900, 799900],
};

/** Multipliers applied to the sale price to get the struck-through original. */
const DISCOUNT_MULTIPLIERS = [1.6, 1.8, 2, 2.2, 2.5, 3];

/* -------------------------------------------------------------------------- */
/*  Lesson composition                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Patterns used to build lesson titles from a section title.
 *
 * Course and section titles are hand-authored; lesson titles are composed. With
 * roughly a thousand sections in the catalogue, writing every lesson by hand
 * would produce worse copy, not better — these patterns are chosen so a section
 * reads as a progression rather than a list of variations on one phrase, and
 * the generator never repeats a pattern within a section.
 */
const LESSON_PATTERNS: Array<(topic: string) => string> = [
  (t) => `Introducing ${lower(t)}`,
  (t) => `${t}: the core idea`,
  (t) => `Working through ${lower(t)}`,
  (t) => `${t} in practice`,
  (_t) => `A worked example`,
  (t) => `Common mistakes with ${lower(t)}`,
  (_t) => `Trade-offs to weigh`,
  (t) => `${t} on a real project`,
  (_t) => `Edge cases worth knowing`,
  (_t) => `Tooling and shortcuts`,
  (_t) => `How this fails in production`,
  (t) => `Putting ${lower(t)} together`,
  (_t) => `Reading and further practice`,
  (t) => `${t}: a deeper pass`,
];

/** Lowercases a section title unless it starts with an acronym or proper noun. */
function lower(title: string): string {
  const first = title.split(" ")[0] ?? "";
  const isProper =
    first.length > 1 && first[0] === first[0]?.toUpperCase() && /[A-Z]{2,}/.test(first);
  return isProper ? title : title.charAt(0).toLowerCase() + title.slice(1);
}

export type SeedLessonType = "VIDEO" | "ARTICLE" | "QUIZ" | "ASSIGNMENT";

export interface GeneratedLesson {
  title: string;
  type: SeedLessonType;
  durationSeconds: number;
  summary: string;
  isFreePreview: boolean;
  article?: string;
  quiz?: {
    title: string;
    passingScore: number;
    questions: Array<{
      prompt: string;
      type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
      explanation: string;
      options: Array<{ text: string; isCorrect: boolean }>;
    }>;
  };
  assignment?: { title: string; instructions: string; rubric: string; maxPoints: number };
}

export interface GeneratedSection {
  title: string;
  description: string;
  lessons: GeneratedLesson[];
}

export interface GeneratedCourse {
  slug: string;
  /** Path under /public. Never null — every course ships with artwork. */
  thumbnailUrl: string;
  title: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  instructorSlug: string;
  level: Blueprint["level"];
  language: string;
  /** Sale price, in paise. */
  priceAmount: number;
  /** Struck-through original, in paise. Null when not discounted. */
  compareAtAmount: number | null;
  isBestseller: boolean;
  ratingAvg: number;
  ratingCount: number;
  enrollmentCount: number;
  tags: string[];
  learningObjectives: string[];
  prerequisites: string[];
  sections: GeneratedSection[];
}

/** URL-safe slug from a title. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LANGUAGES = ["en", "en", "en", "en", "hi", "es"];

/* -------------------------------------------------------------------------- */
/*  Expansion                                                                 */
/* -------------------------------------------------------------------------- */

function buildDescription(bp: Blueprint): string {
  const first = bp.spine[0] ?? "the fundamentals";
  const last = bp.spine[bp.spine.length - 1] ?? "the finished result";
  return [
    `${bp.subtitle}`,
    ``,
    `This course starts with ${lower(first)} and works through to ${lower(last)}. Each section builds on the one before it, so the sequence matters — it is designed to be taken in order rather than dipped into.`,
    ``,
    `Every module ends with something you produce yourself: a piece of work, a decision defended in writing, or a check that you can apply the idea without the material in front of you. There are no lectures that end with "and that is the theory" — if a concept cannot be practised, it is not in the course.`,
  ].join("\n");
}

function buildObjectives(bp: Blueprint, next: () => number): string[] {
  const openers = [
    "Explain",
    "Apply",
    "Decide when to use",
    "Diagnose problems in",
    "Build something using",
    "Evaluate",
  ];
  // One objective per section, capped at six — a list longer than that is not
  // read, and a course whose promises nobody reads has made none.
  return bp.spine
    .slice(0, 6)
    .map((topic, index) => {
      const opener = openers[index % openers.length] ?? "Apply";
      return `${opener} ${lower(topic)} in work of your own.`;
    })
    .map((line) =>
      next() > 0.85 ? line.replace(" in work of your own.", ", and justify the choice.") : line,
    );
}

function buildPrerequisites(bp: Blueprint): string[] {
  switch (bp.level) {
    case "BEGINNER":
      return [];
    case "ALL_LEVELS":
      return ["No formal prerequisites — the first section sets the baseline."];
    case "INTERMEDIATE":
      return [
        "Comfortable with the fundamentals of the subject.",
        "Some hands-on experience, even if informal.",
      ];
    case "ADVANCED":
      return [
        "Working experience with the subject in a real project.",
        "Comfortable reading documentation and source without hand-holding.",
        "Familiar with the tooling used in the examples.",
      ];
  }
}

function buildLessons(
  section: string,
  sectionIndex: number,
  isFirstSection: boolean,
  next: () => number,
): GeneratedLesson[] {
  const count = intBetween(next, 5, 9);
  const lessons: GeneratedLesson[] = [];

  // Patterns are drawn without replacement inside a section, so no section
  // repeats a phrasing.
  const available = [...LESSON_PATTERNS];

  for (let i = 0; i < count; i += 1) {
    const isLast = i === count - 1;
    const patternIndex = Math.floor(next() * available.length);
    const pattern = available.splice(patternIndex, 1)[0] ?? LESSON_PATTERNS[0]!;

    // The last lesson of a section is a check; roughly a third of those are an
    // assignment rather than a quiz, so the catalogue exercises both paths.
    let type: SeedLessonType = "VIDEO";
    if (isLast) type = next() > 0.66 ? "ASSIGNMENT" : "QUIZ";
    else if (next() > 0.78) type = "ARTICLE";

    const title =
      type === "QUIZ"
        ? `Checkpoint: ${lower(section)}`
        : type === "ASSIGNMENT"
          ? `Practice: ${lower(section)}`
          : pattern(section);

    const lesson: GeneratedLesson = {
      title,
      type,
      durationSeconds:
        type === "QUIZ"
          ? intBetween(next, 300, 720)
          : type === "ASSIGNMENT"
            ? intBetween(next, 900, 2400)
            : type === "ARTICLE"
              ? intBetween(next, 360, 900)
              : intBetween(next, 420, 1500),
      summary: `Part of "${section}".`,
      // One free preview per course: the opening lesson. A paywalled catalogue
      // with nothing to sample converts badly and tells the buyer nothing.
      isFreePreview: isFirstSection && i === 0,
    };

    if (type === "ARTICLE") {
      lesson.article = [
        `<p>${section} is one of those topics that looks simple in a summary and turns out to have edges once you use it on something real. This article walks through those edges.</p>`,
        `<p>Start with the case that works. Then change one assumption at a time and watch what breaks — that is usually faster than reading a specification end to end, and it leaves you with a mental model rather than a memorised list.</p>`,
        `<p>The exercises at the end of this section are where the idea actually lands. Read this first, then do them.</p>`,
      ].join("");
    }

    if (type === "QUIZ") {
      lesson.quiz = {
        title: `Checkpoint: ${lower(section)}`,
        passingScore: 70,
        questions: [
          {
            prompt: `What is the main reason ${lower(section)} matters in practice?`,
            type: "SINGLE_CHOICE",
            explanation:
              "The section argued this from a worked example rather than from first principles — the practical consequence is the point.",
            options: [
              { text: "It changes a decision you would otherwise get wrong.", isCorrect: true },
              { text: "It is required by most style guides.", isCorrect: false },
              { text: "It makes the code shorter.", isCorrect: false },
              { text: "It is a common interview question.", isCorrect: false },
            ],
          },
          {
            prompt: `Applying ${lower(section)} always improves the outcome.`,
            type: "TRUE_FALSE",
            explanation:
              "Every technique in this course has a cost. Knowing when it does not apply is as useful as knowing how to use it.",
            options: [
              { text: "True", isCorrect: false },
              { text: "False", isCorrect: true },
            ],
          },
        ],
      };
    }

    if (type === "ASSIGNMENT") {
      lesson.assignment = {
        title: `Practice: ${lower(section)}`,
        instructions: `Apply what this section covered to a problem of your own — something from your work if you have one, or the sample provided. Submit what you produced along with a short note on the decision you found hardest and why you settled it the way you did.`,
        rubric: `Full marks for work that applies the technique correctly **and** explains a trade-off in its own words. Work that applies the technique without any reasoning scores partial marks; reasoning with no applied work does not pass.`,
        maxPoints: 100,
      };
    }

    lessons.push(lesson);
  }

  // A section whose ordering placed the check first would read oddly; the loop
  // above guarantees it is last, but assert the invariant rather than trust it.
  if (sectionIndex >= 0 && lessons.length === 0) {
    throw new Error(`Section "${section}" generated no lessons`);
  }

  return lessons;
}

/** Expands one blueprint into a full course. */
function expand(bp: Blueprint): GeneratedCourse {
  const slug = slugify(bp.title);
  const next = rng(slug);

  // Instructors are matched to the course's category, so authorship is always
  // plausible. The choice is seeded, so it never moves between runs.
  const eligible = INSTRUCTORS.filter((i) => i.categories.includes(bp.category));
  const instructor = eligible.length > 0 ? pick(next, eligible) : pick(next, INSTRUCTORS);

  const band = PRICE_BANDS[bp.level];
  const priceAmount = bp.priceAmountOverride ?? pick(next, band);

  // Roughly two thirds of the catalogue is discounted, which is about what a
  // real marketplace looks like — a catalogue where everything is on sale
  // reads as though nothing is.
  const discounted = next() < 0.68;
  const multiplier = pick(next, DISCOUNT_MULTIPLIERS);
  const compareAtAmount =
    bp.compareAtAmountOverride !== undefined
      ? bp.compareAtAmountOverride
      : discounted
        ? Math.round((priceAmount * multiplier) / 10000) * 10000
        : null;

  // Ratings cluster high, as they do on every marketplace, but with enough
  // spread that sorting by rating is not arbitrary.
  const ratingAvg = bp.ratingAvgOverride ?? Number((3.9 + next() * 1.05).toFixed(1));
  const ratingCount = intBetween(next, 18, 4200);
  const enrollmentCount = bp.enrollmentCountOverride ?? ratingCount * intBetween(next, 6, 22);

  const sections: GeneratedSection[] = bp.spine.map((title, index) => ({
    title,
    description: `What this section covers and why it comes ${index === 0 ? "first" : "here"}.`,
    lessons: buildLessons(title, index, index === 0, next),
  }));

  return {
    slug,
    thumbnailUrl: bp.thumbnailUrl ?? artworkFor(bp.category, slug),
    title: bp.title,
    subtitle: bp.subtitle,
    description: buildDescription(bp),
    categorySlug: bp.category,
    instructorSlug: instructor.slug,
    level: bp.level,
    language: bp.category === "languages" ? "en" : pick(next, LANGUAGES),
    priceAmount,
    compareAtAmount,
    isBestseller: next() < 0.16,
    ratingAvg,
    ratingCount,
    enrollmentCount,
    tags: bp.tags,
    learningObjectives: buildObjectives(bp, next),
    prerequisites: buildPrerequisites(bp),
    sections,
  };
}

/**
 * The whole generated catalogue.
 *
 * Duplicate titles and slugs are a hard error rather than a silent overwrite:
 * two blueprints colliding would mean one course quietly vanishes from the
 * catalogue, which is exactly the kind of bug a seed should never hide.
 */
export function generateCatalogue(): GeneratedCourse[] {
  const all = [...BLUEPRINTS, ...BLUEPRINTS_EXTRA, ...CLIENT_COURSES];

  const seenTitle = new Set<string>();
  const seenSlug = new Set<string>();
  for (const bp of all) {
    const slug = slugify(bp.title);
    if (seenTitle.has(bp.title)) throw new Error(`Duplicate blueprint title: ${bp.title}`);
    if (seenSlug.has(slug)) throw new Error(`Duplicate blueprint slug: ${slug}`);
    seenTitle.add(bp.title);
    seenSlug.add(slug);
  }

  return all.map(expand);
}
