/**
 * Development seed.
 *
 * Populates a local database with a realistic slice of the platform: staff and
 * learner accounts, six categories, four instructors, six published courses
 * with full section/lesson trees (video, article, PDF, quiz and assignment
 * lessons), enrolments with partial progress, and reviews whose aggregates are
 * computed rather than typed in.
 *
 * Safety:
 *  - refuses to run against NODE_ENV=production;
 *  - contains no real credentials. Every account shares one throwaway password
 *    read from SEED_USER_PASSWORD, hashed with Argon2id at run time. The hash
 *    is generated here, never committed.
 */

import { hash } from "@node-rs/argon2";

import { generateSerial } from "../src/lib/certificate-serial.js";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  AttemptStatus,
  CourseInstructorRole,
  CourseLevel,
  CourseStatus,
  EnrollmentSource,
  EnrollmentStatus,
  LessonType,
  PrismaClient,
  QuestionType,
  ResourceKind,
  ReviewStatus,
  UserRole,
} from "../src/generated/prisma/client.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === "production") {
  throw new Error("The development seed must never run against production.");
}

import { CATEGORIES, INSTRUCTORS, TAGS } from "./catalog/taxonomy";
import { generateCatalogue } from "./catalog/generate";
import { artworkForCategory } from "./catalog/artwork";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres instance.",
  );
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Shared across every seeded account. Local development only. */
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "coursera-dev-only-password";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

// ---------------------------------------------------------------------------
// Content fixtures
// ---------------------------------------------------------------------------

/**
 * Taxonomy and instructors come from `catalog/taxonomy.ts`, which is also what
 * the generator reads. One source means a generated course can never reference
 * a category or author the seed did not create.
 */
const categories = CATEGORIES;

const tags = [...TAGS];

const instructors = INSTRUCTORS;

const students = [
  { email: "amara@coursera.test", name: "Amara Osei", location: "Accra, Ghana" },
  { email: "rafael@coursera.test", name: "Rafael Duarte", location: "Porto, Portugal" },
  { email: "ingrid@coursera.test", name: "Ingrid Halvorsen", location: "Bergen, Norway" },
  { email: "sam@coursera.test", name: "Sam Achebe", location: "Manchester, UK" },
  { email: "nadia@coursera.test", name: "Nadia Farouk", location: "Cairo, Egypt" },
  { email: "wei@coursera.test", name: "Wei Chen", location: "Taipei, Taiwan" },
];

interface SeedLesson {
  title: string;
  type: LessonType;
  durationSeconds: number;
  summary?: string;
  isFreePreview?: boolean;
  article?: string;
  resources?: Array<{ title: string; kind: ResourceKind; externalUrl?: string; fileKey?: string }>;
  quiz?: {
    title: string;
    passingScore: number;
    questions: Array<{
      prompt: string;
      type: QuestionType;
      explanation: string;
      options: Array<{ text: string; isCorrect: boolean }>;
    }>;
  };
  assignment?: {
    title: string;
    instructions: string;
    rubric: string;
    maxPoints: number;
  };
}

interface SeedSection {
  title: string;
  description: string;
  lessons: SeedLesson[];
}

interface SeedCourse {
  slug: string;
  /** Path under /public. Back-filled from the category set when absent. */
  thumbnailUrl?: string;
  /**
   * Social proof for generated courses.
   *
   * The hand-authored courses leave these unset and have them derived from real
   * Review and Enrollment rows at the end of the seed. Generated courses carry
   * them as fixture values instead — creating four thousand review rows per
   * course to back a rating would make the seed take an hour and prove nothing.
   * The derivation step below skips any course that supplies them.
   */
  ratingAvg?: number;
  ratingCount?: number;
  enrollmentCount?: number;
  language?: string;
  title: string;
  subtitle: string;
  description: string;
  categorySlug: string;
  instructorSlug: string;
  level: CourseLevel;
  priceAmount: number;
  compareAtAmount: number | null;
  isBestseller: boolean;
  tags: string[];
  learningObjectives: string[];
  prerequisites: string[];
  sections: SeedSection[];
}

const courses: SeedCourse[] = [
  {
    slug: "systems-design-foundations",
    title: "Systems Design Foundations",
    subtitle:
      "Rebuild four production architectures and learn the trade-offs behind queues, caches and replicas.",
    description:
      "Most systems design material teaches you to recite components. This course makes you build four systems badly first, watch them fall over under load, and then fix them — so the trade-offs are something you have felt rather than memorised.",
    categorySlug: "programming",
    instructorSlug: "priya-raghunathan",
    level: CourseLevel.INTERMEDIATE,
    priceAmount: 299900,
    compareAtAmount: 499900,
    isBestseller: true,
    tags: ["architecture", "scalability", "databases", "reliability"],
    learningObjectives: [
      "Read a latency histogram and say what the p99 is actually telling you",
      "Choose between write-through, write-behind and read-through caching for a given workload",
      "Explain consistent hashing well enough to defend it in a design review",
      "Identify the thundering-herd failure mode before it reaches production",
      "Size a queue and justify the number against real throughput figures",
    ],
    prerequisites: [
      "Comfortable writing and reading code in any backend language",
      "Have deployed at least one service that talks to a database",
      "No prior distributed systems theory required",
    ],
    sections: [
      {
        title: "Groundwork",
        description: "The vocabulary and the measurement habits everything else depends on.",
        lessons: [
          {
            title: "What we mean by 'it does not scale'",
            type: LessonType.VIDEO,
            durationSeconds: 780,
            summary: "Latency, throughput and saturation, defined precisely enough to argue about.",
            isFreePreview: true,
          },
          {
            title: "Reading a latency histogram",
            type: LessonType.ARTICLE,
            durationSeconds: 540,
            article:
              "<p>An average latency is almost always a lie. This article walks through why the p50 and the p99 tell different stories, and why the p99 is the one your users experience.</p><p>We work through a real histogram from a checkout service and identify the two distinct populations hiding inside it.</p>",
          },
          {
            title: "Reference architecture diagrams",
            type: LessonType.PDF,
            durationSeconds: 300,
            resources: [
              {
                title: "Four reference architectures (PDF)",
                kind: ResourceKind.PDF,
                fileKey: "seed/systems-design/reference-architectures.pdf",
              },
            ],
          },
          {
            title: "Checkpoint: measurement",
            type: LessonType.QUIZ,
            durationSeconds: 420,
            quiz: {
              title: "Measurement checkpoint",
              passingScore: 70,
              questions: [
                {
                  prompt:
                    "A service reports a mean latency of 40ms and a p99 of 2.1s. What is the most likely explanation?",
                  type: QuestionType.SINGLE_CHOICE,
                  explanation:
                    "A large gap between mean and p99 points at a slow minority path — often a cache miss falling through to a cold query.",
                  options: [
                    { text: "The mean is wrong and should be recalculated", isCorrect: false },
                    {
                      text: "A small fraction of requests take a much slower path",
                      isCorrect: true,
                    },
                    { text: "The service is CPU bound across all requests", isCorrect: false },
                    {
                      text: "p99 is not a meaningful measure below 1000 requests",
                      isCorrect: false,
                    },
                  ],
                },
                {
                  prompt: "Which of these increase effective throughput? Select all that apply.",
                  type: QuestionType.MULTIPLE_CHOICE,
                  explanation:
                    "Batching and connection reuse both reduce per-request overhead. Adding retries without backoff amplifies load during an incident.",
                  options: [
                    { text: "Batching writes", isCorrect: true },
                    { text: "Reusing pooled connections", isCorrect: true },
                    { text: "Retrying failed requests immediately", isCorrect: false },
                    { text: "Increasing the per-request payload size", isCorrect: false },
                  ],
                },
                {
                  prompt: "Saturation is best described as a resource being close to its limit.",
                  type: QuestionType.TRUE_FALSE,
                  explanation:
                    "Saturation is the degree to which a resource is fully utilised — the fourth of the USE method's signals.",
                  options: [
                    { text: "True", isCorrect: true },
                    { text: "False", isCorrect: false },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        title: "Caching and consistency",
        description: "Where most real systems get both their speed and their bugs.",
        lessons: [
          {
            title: "Cache invalidation, concretely",
            type: LessonType.VIDEO,
            durationSeconds: 1140,
            summary: "Write-through, write-behind and the stampede you will eventually cause.",
          },
          {
            title: "Consistent hashing without the hand-waving",
            type: LessonType.VIDEO,
            durationSeconds: 960,
          },
          {
            title: "Build a cache layer",
            type: LessonType.ASSIGNMENT,
            durationSeconds: 3600,
            assignment: {
              title: "Add a cache to the orders service",
              instructions:
                "Take the provided orders service and add a read-through cache. Include a written note (300 words maximum) explaining your invalidation strategy and the failure mode you consider most likely.",
              rubric:
                "Correctness of invalidation (40) · Handling of the thundering-herd case (30) · Clarity of the written rationale (30)",
              maxPoints: 100,
            },
          },
        ],
      },
    ],
  },
  {
    slug: "writing-for-engineers",
    title: "Writing for Engineers",
    subtitle:
      "Design docs, incident reports and review comments that people actually read and act on.",
    description:
      "A course about the writing that engineering actually runs on. You will rewrite a real design document three times, learn why the first version got ignored, and finish with a template you will keep using.",
    categorySlug: "business",
    instructorSlug: "daniel-okonkwo",
    level: CourseLevel.ALL_LEVELS,
    priceAmount: 149900,
    compareAtAmount: null,
    isBestseller: false,
    tags: ["communication", "documentation"],
    learningObjectives: [
      "Open a design document with the decision rather than the context",
      "Represent rejected alternatives fairly enough that reviewers trust you",
      "Write an incident report that produces action items instead of blame",
      "Leave review comments people act on rather than argue with",
    ],
    prerequisites: [
      "Currently writing documents that other engineers read",
      "No writing background needed",
    ],
    sections: [
      {
        title: "Why your document was ignored",
        description: "Diagnosing the failure before trying to fix the prose.",
        lessons: [
          {
            title: "The reader you actually have",
            type: LessonType.VIDEO,
            durationSeconds: 720,
            isFreePreview: true,
          },
          {
            title: "Leading with the decision",
            type: LessonType.ARTICLE,
            durationSeconds: 480,
            article:
              "<p>Most engineering documents bury the decision on page three, underneath the context that justifies it. Readers who skim — which is all of them — never reach it.</p><p>The fix is structural, not stylistic: state the decision, then the alternatives you rejected, then the evidence.</p>",
          },
        ],
      },
      {
        title: "The design document",
        description: "One document, rewritten three times.",
        lessons: [
          {
            title: "Draft one: the information dump",
            type: LessonType.VIDEO,
            durationSeconds: 900,
          },
          {
            title: "Design document template",
            type: LessonType.PDF,
            durationSeconds: 240,
            resources: [
              {
                title: "Design document template",
                kind: ResourceKind.PDF,
                fileKey: "seed/writing/design-doc-template.pdf",
              },
            ],
          },
          {
            title: "Rewrite a real design document",
            type: LessonType.ASSIGNMENT,
            durationSeconds: 2700,
            assignment: {
              title: "Rewrite the notifications design doc",
              instructions:
                "The provided document was rejected in review. Rewrite it so the decision is clear in the first hundred words, and list the two alternatives that were considered.",
              rubric:
                "Decision stated up front (40) · Alternatives fairly represented (30) · Length discipline (30)",
              maxPoints: 100,
            },
          },
        ],
      },
    ],
  },
  {
    slug: "statistics-you-will-actually-use",
    title: "Statistics You Will Actually Use",
    subtitle:
      "Confidence, causality and sample size, taught against messy datasets rather than clean textbook ones.",
    description:
      "Every dataset in this course is real and slightly broken. You will learn to tell a genuine effect from a lucky sample, and to say honestly when the data cannot answer the question.",
    categorySlug: "data-science",
    instructorSlug: "mei-tanaka",
    level: CourseLevel.BEGINNER,
    priceAmount: 0,
    compareAtAmount: null,
    isBestseller: true,
    tags: ["statistics", "analysis"],
    learningObjectives: [
      "Tell a genuine effect from a lucky sample",
      "Work out the sample size a question needs before collecting anything",
      "Explain why a p-value is not the probability your hypothesis is true",
      "Say honestly when the data cannot answer the question asked",
    ],
    prerequisites: ["School-level arithmetic", "No statistics background assumed"],
    sections: [
      {
        title: "Before you calculate anything",
        description: "The design decisions that determine whether the analysis can work at all.",
        lessons: [
          {
            title: "What question are you actually asking?",
            type: LessonType.VIDEO,
            durationSeconds: 660,
            isFreePreview: true,
          },
          {
            title: "Sample size, intuitively",
            type: LessonType.ARTICLE,
            durationSeconds: 600,
            article:
              "<p>Forty users is almost never enough, and this article shows you why using a simulation you can run yourself.</p><p>We generate a population with a known effect, sample it repeatedly at different sizes, and watch how often the sample points the wrong way.</p>",
          },
          {
            title: "Checkpoint: study design",
            type: LessonType.QUIZ,
            durationSeconds: 360,
            quiz: {
              title: "Study design checkpoint",
              passingScore: 70,
              questions: [
                {
                  prompt:
                    "A team ships a feature to all users at once and sees signups rise 8%. What can they conclude?",
                  type: QuestionType.SINGLE_CHOICE,
                  explanation:
                    "With no control group and no randomisation, the rise cannot be attributed to the feature — seasonality or a concurrent campaign are equally consistent with the data.",
                  options: [
                    { text: "The feature caused an 8% rise", isCorrect: false },
                    { text: "The feature caused some rise, but less than 8%", isCorrect: false },
                    { text: "Nothing causal, because there is no control group", isCorrect: true },
                    {
                      text: "The result is significant if the sample is large enough",
                      isCorrect: false,
                    },
                  ],
                },
                {
                  prompt: "A p-value tells you the probability that your hypothesis is true.",
                  type: QuestionType.TRUE_FALSE,
                  explanation:
                    "It is the probability of observing data at least this extreme if the null hypothesis were true — a different statement, and a common misreading.",
                  options: [
                    { text: "True", isCorrect: false },
                    { text: "False", isCorrect: true },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    slug: "design-systems-that-survive",
    title: "Design Systems That Survive Contact With Engineering",
    subtitle:
      "Tokens, components and the governance that stops a system rotting six months after launch.",
    description:
      "Building the component library is the easy part. This course is about the six months afterwards: contribution rules, versioning, and the conversations that keep a system alive.",
    categorySlug: "design",
    instructorSlug: "tomas-lindqvist",
    level: CourseLevel.INTERMEDIATE,
    priceAmount: 249900,
    compareAtAmount: 399900,
    isBestseller: false,
    tags: ["design-systems", "tokens"],
    learningObjectives: [
      "Separate semantic tokens from literal values, and know why it matters",
      "Define a token set that resolves correctly in both light and dark themes",
      "Write a contribution model that keeps a system alive after launch",
      "Audit an existing token set and split the ones doing two jobs",
    ],
    prerequisites: [
      "Have worked with a component library, as designer or engineer",
      "Familiarity with Figma or a similar tool",
    ],
    sections: [
      {
        title: "Tokens first",
        description: "Why the colour decisions have to come before the components.",
        lessons: [
          {
            title: "Semantic tokens versus literal values",
            type: LessonType.VIDEO,
            durationSeconds: 840,
            isFreePreview: true,
          },
          {
            title: "Designing for two themes at once",
            type: LessonType.ARTICLE,
            durationSeconds: 720,
            article:
              "<p>A dark theme is not an inverted light theme. This article covers why naively flipping lightness produces muddy, low-contrast surfaces, and how to define a token set that resolves correctly in both.</p>",
          },
        ],
      },
      {
        title: "Governance",
        description: "The part everyone skips, and the reason systems die.",
        lessons: [
          {
            title: "Writing a contribution model",
            type: LessonType.VIDEO,
            durationSeconds: 900,
          },
          {
            title: "Audit an existing system",
            type: LessonType.ASSIGNMENT,
            durationSeconds: 3600,
            assignment: {
              title: "Token audit",
              instructions:
                "Audit the token set of any design system you have access to. Identify three tokens that are doing two jobs, and propose a split for each.",
              rubric:
                "Accuracy of the audit (40) · Quality of the proposed splits (40) · Presentation (20)",
              maxPoints: 100,
            },
          },
        ],
      },
    ],
  },
  {
    slug: "evaluating-language-models",
    title: "Evaluating Language Models",
    subtitle:
      "Build evaluation sets, measure regressions and tell a real improvement from a lucky sample.",
    description:
      "Shipping a model change without an evaluation set is guessing. This course covers building one that catches regressions, and reading the results without fooling yourself.",
    categorySlug: "artificial-intelligence",
    instructorSlug: "mei-tanaka",
    level: CourseLevel.ADVANCED,
    priceAmount: 499900,
    compareAtAmount: 799900,
    isBestseller: false,
    tags: ["evaluation", "llms", "analysis"],
    learningObjectives: [
      "Build an evaluation set that catches regressions rather than flattering the model",
      "Measure inter-rater agreement and act on a low score",
      "Distinguish a real improvement from noise across runs",
    ],
    prerequisites: [
      "Have shipped or evaluated at least one model-backed feature",
      "Comfortable with basic statistics — the Statistics course covers what is needed",
    ],
    sections: [
      {
        title: "Building an evaluation set",
        description: "What goes in, what stays out, and how big it needs to be.",
        lessons: [
          {
            title: "Sampling cases that matter",
            type: LessonType.VIDEO,
            durationSeconds: 960,
            isFreePreview: true,
          },
          {
            title: "Inter-rater agreement",
            type: LessonType.ARTICLE,
            durationSeconds: 660,
            article:
              "<p>If two careful humans disagree about whether an output is good, no automated metric will settle it. This article covers measuring agreement first, and what to do when it is low.</p>",
          },
        ],
      },
    ],
  },
  {
    slug: "positioning-before-tactics",
    title: "Positioning Before Tactics",
    subtitle:
      "Work out what you are actually selling and to whom, before spending a currency unit on channels.",
    description:
      "Channel tactics fail quietly when the positioning underneath them is vague. This course fixes the order of operations.",
    categorySlug: "marketing",
    instructorSlug: "daniel-okonkwo",
    level: CourseLevel.ALL_LEVELS,
    priceAmount: 199900,
    compareAtAmount: 299900,
    isBestseller: false,
    tags: ["positioning", "strategy"],
    learningObjectives: [
      "Identify the competitive alternative your buyer is actually weighing",
      "Separate the person who decides from the person who pays",
      "Write positioning that survives contact with a real sales conversation",
    ],
    prerequisites: [],
    sections: [
      {
        title: "Finding the actual buyer",
        description: "Who decides, who pays, and why they are often different people.",
        lessons: [
          {
            title: "The competitive alternative",
            type: LessonType.VIDEO,
            durationSeconds: 720,
            isFreePreview: true,
          },
          {
            title: "Positioning worksheet",
            type: LessonType.PDF,
            durationSeconds: 300,
            resources: [
              {
                title: "Positioning worksheet",
                kind: ResourceKind.PDF,
                fileKey: "seed/positioning/worksheet.pdf",
              },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Badge catalogue.
 *
 * Mirrors BADGE_DEFINITIONS in src/features/engagement/badges.ts, which is the
 * source of truth the awarding engine evaluates. Keeping the seed aligned with
 * it means a fresh database can award every badge immediately.
 */
/**
 * The full catalogue.
 *
 * The hand-authored courses above carry rich lesson bodies, real quiz content
 * and the slugs the integration checks depend on; the generated ones give the
 * marketplace its size. Generation is deterministic, so this array is the same
 * on every run and on every machine.
 *
 * Duplicate slugs would mean one course silently overwriting another, so the
 * merge refuses rather than resolves.
 */
const generated: SeedCourse[] = generateCatalogue();

const handAuthoredSlugs = new Set(courses.map((course) => course.slug));
for (const course of generated) {
  if (handAuthoredSlugs.has(course.slug)) {
    throw new Error(`Generated course collides with a hand-authored slug: ${course.slug}`);
  }
}

const allCourses: SeedCourse[] = [...courses, ...generated];

/**
 * Artwork, assigned per category over the whole set at once.
 *
 * Done here rather than inside the generator because an even spread needs every
 * course in the category, and the hand-authored ones are only merged in here.
 */
const artworkBySlug = new Map<string, string>();
for (const categorySlug of new Set(allCourses.map((course) => course.categorySlug))) {
  const slugs = allCourses
    .filter((course) => course.categorySlug === categorySlug)
    .map((course) => course.slug);
  for (const [slug, art] of artworkForCategory(categorySlug, slugs)) {
    artworkBySlug.set(slug, art);
  }
}

const badges = [
  {
    slug: "first-lesson",
    name: "First Lesson",
    description: "Completed your first lesson.",
    iconKey: "footprints",
    tier: "BRONZE" as const,
    criteria: { kind: "lessons_completed", threshold: 1 },
  },
  {
    slug: "first-course",
    name: "First Course Completed",
    description: "Finished a course from beginning to end.",
    iconKey: "award",
    tier: "GOLD" as const,
    criteria: { kind: "courses_completed", threshold: 1 },
  },
  {
    slug: "streak-3",
    name: "3-Day Streak",
    description: "Learned on three consecutive days.",
    iconKey: "flame",
    tier: "BRONZE" as const,
    criteria: { kind: "streak_days", threshold: 3 },
  },
  {
    slug: "streak-7",
    name: "7-Day Streak",
    description: "Learned on seven consecutive days.",
    iconKey: "flame",
    tier: "SILVER" as const,
    criteria: { kind: "streak_days", threshold: 7 },
  },
  {
    slug: "streak-30",
    name: "30-Day Streak",
    description: "Learned every day for a month.",
    iconKey: "flame",
    tier: "GOLD" as const,
    criteria: { kind: "streak_days", threshold: 30 },
  },
  {
    slug: "lessons-100",
    name: "100 Lessons Completed",
    description: "Completed one hundred lessons.",
    iconKey: "trophy",
    tier: "PLATINUM" as const,
    criteria: { kind: "lessons_completed", threshold: 100 },
  },
];

const reviewSeeds = [
  {
    courseSlug: "systems-design-foundations",
    studentEmail: "rafael@coursera.test",
    rating: 5,
    title: "Finally understood consistent hashing",
    body: "I had read about consistent hashing three times and never understood it. Building the thing badly first, then fixing it, is what finally made it land.",
  },
  {
    courseSlug: "systems-design-foundations",
    studentEmail: "wei@coursera.test",
    rating: 4,
    title: "Excellent, but dense",
    body: "The caching section is worth the price on its own. Be warned that section two moves quickly — I rewatched two lessons.",
  },
  {
    courseSlug: "writing-for-engineers",
    studentEmail: "ingrid@coursera.test",
    rating: 5,
    title: "Changed how my team writes",
    body: "My design docs used to get ignored. Two months after this course, one of mine drove an architecture decision across three teams. That is a concrete change.",
  },
  {
    courseSlug: "statistics-you-will-actually-use",
    studentEmail: "sam@coursera.test",
    rating: 5,
    title: "Saved us from a bad launch",
    body: "The section on sample size quietly saved us from shipping a feature on the back of forty users. Worth the whole course on its own.",
  },
  {
    courseSlug: "statistics-you-will-actually-use",
    studentEmail: "amara@coursera.test",
    rating: 4,
    title: "Good pacing for a beginner",
    body: "I came in with no statistics background and did not feel lost. I would have liked one more worked example in the confidence interval lesson.",
  },
  {
    courseSlug: "design-systems-that-survive",
    studentEmail: "nadia@coursera.test",
    rating: 4,
    title: "The governance section is the real value",
    body: "Being able to close the laptop mid-lesson on the train and pick up at the exact second on my phone sounds small. It is the reason I finished.",
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function reset() {
  // Ordered so that every child is removed before its parent. `deleteMany` is
  // used rather than TRUNCATE so this works without elevated privileges.
  await db.auditLog.deleteMany();
  await db.userBadge.deleteMany();
  await db.badge.deleteMany();
  await db.streak.deleteMany();
  await db.learningActivity.deleteMany();
  await db.courseReminder.deleteMany();
  await db.notification.deleteMany();
  await db.certificate.deleteMany();
  await db.courseAnnouncement.deleteMany();
  await db.quizAnswer.deleteMany();
  await db.quizAttempt.deleteMany();
  await db.quizOption.deleteMany();
  await db.quizQuestion.deleteMany();
  await db.quiz.deleteMany();
  await db.assignmentSubmission.deleteMany();
  await db.assignment.deleteMany();
  await db.courseProgress.deleteMany();
  await db.lessonProgress.deleteMany();
  await db.instructorPayoutLine.deleteMany();
  await db.instructorPayout.deleteMany();
  await db.couponRedemption.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.enrollment.deleteMany();
  await db.order.deleteMany();
  await db.coupon.deleteMany();
  await db.review.deleteMany();
  await db.wishlist.deleteMany();
  await db.lessonResource.deleteMany();
  await db.lesson.deleteMany();
  await db.section.deleteMany();
  await db.courseInstructor.deleteMany();
  await db.course.deleteMany();
  await db.tag.deleteMany();
  await db.category.deleteMany();
  await db.instructorProfile.deleteMany();
  await db.profile.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  console.log("Resetting existing data…");
  await reset();

  const passwordHash = await hash(SEED_PASSWORD);

  // --- categories & tags ---------------------------------------------------
  console.log("Seeding categories and tags…");
  const categoryBySlug = new Map<string, string>();
  for (const [index, category] of categories.entries()) {
    const row = await db.category.create({
      data: { ...category, position: index },
    });
    categoryBySlug.set(row.slug, row.id);
  }

  const tagBySlug = new Map<string, string>();
  for (const slug of tags) {
    const row = await db.tag.create({
      data: {
        slug,
        name: slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
      },
    });
    tagBySlug.set(row.slug, row.id);
  }

  // --- users ---------------------------------------------------------------
  console.log("Seeding users…");
  const admin = await db.user.create({
    data: {
      email: "admin@coursera.test",
      name: "Jonas Meyer",
      role: UserRole.ADMIN,
      passwordHash,
      emailVerified: daysAgo(120),
      timezone: "Europe/Berlin",
      profile: {
        create: { headline: "Platform administrator", location: "Berlin, Germany" },
      },
      streak: { create: { currentDays: 0, longestDays: 3, timezone: "Europe/Berlin" } },
    },
  });

  const instructorBySlug = new Map<string, { userId: string; profileId: string }>();
  for (const instructor of instructors) {
    const user = await db.user.create({
      data: {
        email: instructor.email,
        name: instructor.name,
        role: UserRole.INSTRUCTOR,
        passwordHash,
        emailVerified: daysAgo(200),
        profile: {
          create: {
            headline: instructor.headline,
            bio: instructor.bio,
            location: instructor.location,
          },
        },
        instructorProfile: {
          create: {
            slug: instructor.slug,
            headline: instructor.headline,
            bio: instructor.bio,
            expertise: instructor.expertise,
            approvedAt: daysAgo(190),
          },
        },
        streak: { create: { currentDays: 2, longestDays: 21 } },
      },
      include: { instructorProfile: true },
    });

    instructorBySlug.set(instructor.slug, {
      userId: user.id,
      profileId: user.instructorProfile?.id ?? "",
    });
  }

  const studentByEmail = new Map<string, string>();
  for (const [index, student] of students.entries()) {
    const user = await db.user.create({
      data: {
        email: student.email,
        name: student.name,
        role: UserRole.STUDENT,
        passwordHash,
        emailVerified: daysAgo(60 - index * 5),
        profile: { create: { location: student.location } },
        streak: {
          create: {
            currentDays: index % 4,
            longestDays: 5 + index * 2,
            lastActiveDate: daysAgo(index % 3),
          },
        },
      },
    });
    studentByEmail.set(student.email, user.id);
  }

  // --- badges --------------------------------------------------------------
  console.log("Seeding badges…");
  const badgeBySlug = new Map<string, string>();
  for (const badge of badges) {
    const row = await db.badge.create({ data: badge });
    badgeBySlug.set(row.slug, row.id);
  }

  // --- courses -------------------------------------------------------------
  console.log("Seeding courses, sections and lessons…");
  const courseBySlug = new Map<string, { id: string; lessonIds: string[] }>();

  for (const course of allCourses) {
    const categoryId = categoryBySlug.get(course.categorySlug);
    const instructor = instructorBySlug.get(course.instructorSlug);
    if (!categoryId || !instructor) {
      throw new Error(`Bad fixture reference in course ${course.slug}`);
    }

    const lessonCount = course.sections.reduce((sum, s) => sum + s.lessons.length, 0);
    const durationSeconds = course.sections.reduce(
      (sum, s) => sum + s.lessons.reduce((inner, l) => inner + l.durationSeconds, 0),
      0,
    );

    const created = await db.course.create({
      data: {
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        categoryId,
        level: course.level,
        status: CourseStatus.PUBLISHED,
        publishedAt: daysAgo(45),
        priceAmount: course.priceAmount,
        compareAtAmount: course.compareAtAmount,
        currency: "INR",
        isBestseller: course.isBestseller,
        // Every course gets artwork. The hand-authored ones do not carry a
        // path, so they draw from their category's set the same way the
        // generated ones do — no course is ever left without an image.
        thumbnailUrl: artworkBySlug.get(course.slug) ?? course.thumbnailUrl ?? null,
        language: course.language ?? "en",
        ratingAvg: course.ratingAvg ?? 0,
        ratingCount: course.ratingCount ?? 0,
        enrollmentCount: course.enrollmentCount ?? 0,
        learningObjectives: course.learningObjectives,
        prerequisites: course.prerequisites,
        lessonCount,
        durationMinutes: Math.round(durationSeconds / 60),
        tags: {
          connect: course.tags.map((slug) => ({ id: tagBySlug.get(slug) ?? "" })),
        },
        instructors: {
          create: {
            userId: instructor.userId,
            role: CourseInstructorRole.OWNER,
            revenueShareBps: 10000,
          },
        },
      },
    });

    const lessonIds: string[] = [];

    for (const [sectionIndex, section] of course.sections.entries()) {
      const createdSection = await db.section.create({
        data: {
          courseId: created.id,
          title: section.title,
          description: section.description,
          position: sectionIndex,
        },
      });

      for (const [lessonIndex, lesson] of section.lessons.entries()) {
        const createdLesson = await db.lesson.create({
          data: {
            sectionId: createdSection.id,
            courseId: created.id,
            title: lesson.title,
            summary: lesson.summary,
            type: lesson.type,
            position: lessonIndex,
            isFreePreview: lesson.isFreePreview ?? false,
            durationSeconds: lesson.durationSeconds,
            articleContent: lesson.article,
            // Video assets are placeholders until the Phase 8 media pipeline.
            // No media pipeline exists, so no video asset exists either. The
            // lesson is marked PENDING with no playback id rather than given a
            // fabricated one — the player renders an explicit placeholder for
            // exactly this state.
            videoStatus: "PENDING",
            videoPlaybackId: null,
          },
        });
        lessonIds.push(createdLesson.id);

        for (const [resourceIndex, resource] of (lesson.resources ?? []).entries()) {
          await db.lessonResource.create({
            data: {
              lessonId: createdLesson.id,
              title: resource.title,
              kind: resource.kind,
              fileKey: resource.fileKey,
              externalUrl: resource.externalUrl,
              mimeType: resource.kind === ResourceKind.PDF ? "application/pdf" : null,
              position: resourceIndex,
            },
          });
        }

        if (lesson.quiz) {
          const createdQuiz = await db.quiz.create({
            data: {
              lessonId: createdLesson.id,
              title: lesson.quiz.title,
              passingScore: lesson.quiz.passingScore,
              maxAttempts: 3,
            },
          });

          for (const [questionIndex, question] of lesson.quiz.questions.entries()) {
            await db.quizQuestion.create({
              data: {
                quizId: createdQuiz.id,
                prompt: question.prompt,
                type: question.type,
                explanation: question.explanation,
                points: 1,
                position: questionIndex,
                options: {
                  create: question.options.map((option, optionIndex) => ({
                    text: option.text,
                    isCorrect: option.isCorrect,
                    position: optionIndex,
                  })),
                },
              },
            });
          }
        }

        if (lesson.assignment) {
          await db.assignment.create({
            data: {
              lessonId: createdLesson.id,
              title: lesson.assignment.title,
              instructions: lesson.assignment.instructions,
              rubric: lesson.assignment.rubric,
              maxPoints: lesson.assignment.maxPoints,
              dueInDays: 14,
            },
          });
        }
      }
    }

    courseBySlug.set(course.slug, { id: created.id, lessonIds });
  }

  // --- enrolments, progress and reviews ------------------------------------
  console.log("Seeding enrolments, progress and reviews…");

  /** Each student enrols in a couple of courses with partial progress. */
  const enrolmentPlan: Array<{ email: string; courseSlug: string; completedRatio: number }> = [
    { email: "rafael@coursera.test", courseSlug: "systems-design-foundations", completedRatio: 1 },
    { email: "rafael@coursera.test", courseSlug: "writing-for-engineers", completedRatio: 0.4 },
    { email: "wei@coursera.test", courseSlug: "systems-design-foundations", completedRatio: 0.6 },
    { email: "ingrid@coursera.test", courseSlug: "writing-for-engineers", completedRatio: 1 },
    {
      email: "sam@coursera.test",
      courseSlug: "statistics-you-will-actually-use",
      completedRatio: 1,
    },
    {
      email: "amara@coursera.test",
      courseSlug: "statistics-you-will-actually-use",
      completedRatio: 0.5,
    },
    {
      email: "amara@coursera.test",
      courseSlug: "design-systems-that-survive",
      completedRatio: 0.2,
    },
    { email: "nadia@coursera.test", courseSlug: "design-systems-that-survive", completedRatio: 1 },
    { email: "wei@coursera.test", courseSlug: "evaluating-language-models", completedRatio: 0.3 },
  ];

  for (const plan of enrolmentPlan) {
    const userId = studentByEmail.get(plan.email);
    const course = courseBySlug.get(plan.courseSlug);
    const courseFixture = courses.find((c) => c.slug === plan.courseSlug);
    if (!userId || !course || !courseFixture) continue;

    const completedCount = Math.round(course.lessonIds.length * plan.completedRatio);
    const isComplete = completedCount === course.lessonIds.length;

    const enrollment = await db.enrollment.create({
      data: {
        userId,
        courseId: course.id,
        status: isComplete ? EnrollmentStatus.COMPLETED : EnrollmentStatus.ACTIVE,
        source: courseFixture.priceAmount === 0 ? EnrollmentSource.FREE : EnrollmentSource.PURCHASE,
        enrolledAt: daysAgo(30),
        completedAt: isComplete ? daysAgo(3) : null,
      },
    });

    for (const [index, lessonId] of course.lessonIds.entries()) {
      const completed = index < completedCount;
      await db.lessonProgress.create({
        data: {
          userId,
          lessonId,
          completed,
          completedAt: completed ? daysAgo(10 - (index % 8)) : null,
          // The in-flight lesson keeps a real resume position.
          positionSeconds: completed ? 0 : index === completedCount ? 214 : 0,
          lastViewedAt: daysAgo(index % 7),
        },
      });
    }

    await db.courseProgress.create({
      data: {
        enrollmentId: enrollment.id,
        completedLessons: completedCount,
        totalLessons: course.lessonIds.length,
        percent: Math.round((completedCount / course.lessonIds.length) * 100),
        lastLessonId: course.lessonIds[Math.max(0, completedCount - 1)] ?? null,
        lastActivityAt: daysAgo(2),
      },
    });

    if (isComplete) {
      // Serials come from the same generator the application uses, so seeded
      // certificates are as unguessable as real ones. A predictable serial
      // would make the public verification page enumerable.
      await db.certificate.create({
        data: {
          userId,
          courseId: course.id,
          serial: generateSerial(),
          courseTitleSnapshot: courseFixture.title,
          recipientNameSnapshot:
            students.find((s) => s.email === plan.email)?.name ?? "Coursera learner",
          instructorNameSnapshot:
            instructors.find((i) => i.slug === courseFixture.instructorSlug)?.name ?? "Coursera",
          issuedAt: daysAgo(3),
        },
      });
    }
  }

  for (const review of reviewSeeds) {
    const userId = studentByEmail.get(review.studentEmail);
    const course = courseBySlug.get(review.courseSlug);
    if (!userId || !course) continue;

    await db.review.create({
      data: {
        courseId: course.id,
        userId,
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: ReviewStatus.PUBLISHED,
        createdAt: daysAgo(12),
      },
    });
  }

  // --- wishlist, a coupon and one graded quiz attempt ----------------------
  console.log("Seeding wishlist, coupon and a quiz attempt…");

  const amaraId = studentByEmail.get("amara@coursera.test");
  if (amaraId) {
    for (const slug of ["systems-design-foundations", "evaluating-language-models"]) {
      const course = courseBySlug.get(slug);
      if (course) {
        await db.wishlist.create({ data: { userId: amaraId, courseId: course.id } });
      }
    }
  }

  await db.coupon.create({
    data: {
      code: "LAUNCH25",
      type: "PERCENT",
      value: 25,
      maxRedemptions: 500,
      perUserLimit: 1,
      endsAt: new Date(Date.now() + 30 * DAY),
    },
  });

  // A submitted, graded attempt so the assessment tables are not empty.
  const statsQuiz = await db.quiz.findFirst({
    where: { lesson: { course: { slug: "statistics-you-will-actually-use" } } },
    include: { questions: { include: { options: true } } },
  });
  const samId = studentByEmail.get("sam@coursera.test");

  if (statsQuiz && samId) {
    const correctOptions = statsQuiz.questions
      .map((question) => {
        const option = question.options.find((o) => o.isCorrect);
        return option ? { questionId: question.id, optionId: option.id } : null;
      })
      .filter((entry): entry is { questionId: string; optionId: string } => entry !== null);

    await db.quizAttempt.create({
      data: {
        quizId: statsQuiz.id,
        userId: samId,
        status: AttemptStatus.GRADED,
        attemptNumber: 1,
        score: correctOptions.length,
        maxScore: statsQuiz.questions.length,
        passed: true,
        startedAt: daysAgo(9),
        submittedAt: daysAgo(9),
        gradedAt: daysAgo(9),
        answers: {
          create: correctOptions.map((answer) => ({ ...answer, isCorrect: true })),
        },
      },
    });

    const firstLessonBadgeId = badgeBySlug.get("first-lesson");
    if (firstLessonBadgeId) {
      await db.userBadge.create({ data: { userId: samId, badgeId: firstLessonBadgeId } });
    }
  }

  // --- recompute denormalised aggregates -----------------------------------
  // Derived from the rows above rather than hardcoded, so the seed can never
  // ship figures that disagree with its own data.
  console.log("Recomputing aggregates…");

  // Courses carrying fixture aggregates are left alone; deriving them would
  // reset every generated course to zero reviews and zero students.
  const derivedSlugs = new Set(
    allCourses.filter((course) => course.ratingCount === undefined).map((course) => course.slug),
  );

  for (const [slug, course] of courseBySlug) {
    if (!derivedSlugs.has(slug)) continue;

    const [ratings, enrolments] = await Promise.all([
      db.review.aggregate({
        where: { courseId: course.id, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: true,
      }),
      db.enrollment.count({ where: { courseId: course.id } }),
    ]);

    await db.course.update({
      where: { id: course.id },
      data: {
        ratingAvg: Number((ratings._avg.rating ?? 0).toFixed(2)),
        ratingCount: ratings._count,
        enrollmentCount: enrolments,
      },
    });

    void slug;
  }

  for (const [, category] of categoryBySlug) {
    const count = await db.course.count({
      where: { categoryId: category, status: CourseStatus.PUBLISHED },
    });
    await db.category.update({ where: { id: category }, data: { courseCount: count } });
  }

  for (const [, instructor] of instructorBySlug) {
    const taught = await db.courseInstructor.findMany({
      where: { userId: instructor.userId },
      select: { courseId: true },
    });
    const courseIds = taught.map((row) => row.courseId);

    const [studentCount, ratings] = await Promise.all([
      db.enrollment.count({ where: { courseId: { in: courseIds } } }),
      db.review.aggregate({
        where: { courseId: { in: courseIds }, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    await db.instructorProfile.update({
      where: { id: instructor.profileId },
      data: {
        courseCount: courseIds.length,
        studentCount,
        ratingAvg: Number((ratings._avg.rating ?? 0).toFixed(2)),
        ratingCount: ratings._count,
      },
    });
  }

  // --- summary -------------------------------------------------------------
  const counts = {
    users: await db.user.count(),
    categories: await db.category.count(),
    tags: await db.tag.count(),
    courses: await db.course.count(),
    sections: await db.section.count(),
    lessons: await db.lesson.count(),
    quizzes: await db.quiz.count(),
    assignments: await db.assignment.count(),
    enrollments: await db.enrollment.count(),
    reviews: await db.review.count(),
    certificates: await db.certificate.count(),
    badges: await db.badge.count(),
  };

  console.log("\nSeed complete:");
  for (const [label, value] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(14)} ${value}`);
  }
  console.log(`\nAll accounts share the password from SEED_USER_PASSWORD.`);
  console.log(`  admin       admin@coursera.test`);
  console.log(`  instructor  priya@coursera.test`);
  console.log(`  student     amara@coursera.test`);
  void admin;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
