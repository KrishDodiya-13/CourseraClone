/**
 * Read models for the public catalogue.
 *
 * These mirror the Phase 0 entity plan and are deliberately the *shape a page
 * needs*, not the shape a table has — a `CourseSummary` is what a Prisma
 * `select` will return for a card, already joined and aggregated. When Phase 3
 * lands the schema and Phase 5 lands the queries, these interfaces become the
 * return types of `features/catalog/queries.ts` and the components below do
 * not change.
 *
 * Two conventions carried over from Phase 0:
 *  - money is integer minor units plus an ISO currency code, never a float;
 *  - `ratingAvg` / `enrollmentCount` are denormalised aggregates, because
 *    sorting a catalogue by them per request is the first thing to get slow.
 */

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS";

export const courseLevelLabels: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All levels",
};

/** Keys map to a Lucide icon in `category-icon.tsx`; the DB stores the key. */
export type CategoryIconKey =
  "code" | "chart" | "brain" | "palette" | "briefcase" | "megaphone" | "shield" | "camera";

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: CategoryIconKey;
  courseCount: number;
}

export interface InstructorSummary {
  id: string;
  slug: string;
  name: string;
  /** Short professional line shown under the name. */
  headline: string;
  avatarUrl: string | null;
  /** Denormalised aggregates on InstructorProfile. */
  ratingAvg: number;
  studentCount: number;
  courseCount: number;
  expertise: string[];
}

/** The instructor fields a course card needs — a subset, not the full record. */
export type CourseCardInstructor = Pick<InstructorSummary, "id" | "slug" | "name" | "avatarUrl">;

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  level: CourseLevel;
  /// ISO 639-1.
  language: string;
  category: Pick<CategorySummary, "slug" | "name">;
  tags: string[];
  tagSlugs: string[];
  instructor: CourseCardInstructor;

  /** Integer minor units. 0 means free. */
  priceAmount: number;
  /** Original price for a strike-through, or null when not discounted. */
  compareAtAmount: number | null;
  /** ISO 4217. */
  currency: string;

  ratingAvg: number;
  ratingCount: number;
  enrollmentCount: number;
  lessonCount: number;
  durationMinutes: number;

  isBestseller: boolean;
  /** ISO 8601. */
  updatedAt: string;
}

export interface TestimonialSummary {
  id: string;
  quote: string;
  rating: number;
  author: {
    name: string;
    /** Job title or context, e.g. "Backend engineer at a logistics startup". */
    role: string;
    avatarUrl: string | null;
  };
  courseTitle: string;
}

/* -------------------------------------------------------------------------- */
/*  Course detail                                                             */
/* -------------------------------------------------------------------------- */

export type LessonKind = "VIDEO" | "ARTICLE" | "PDF" | "QUIZ" | "ASSIGNMENT";

export interface CurriculumLesson {
  id: string;
  title: string;
  summary: string | null;
  type: LessonKind;
  durationSeconds: number;
  /**
   * Whether this lesson is playable without an enrolment.
   *
   * Note what is absent: no playback id, no file key, no article body. The
   * curriculum is public; the content behind it is granted per request after
   * an enrolment check.
   */
  isFreePreview: boolean;
}

export interface CurriculumSection {
  id: string;
  title: string;
  description: string | null;
  lessons: CurriculumLesson[];
}

export interface CourseReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  /** ISO 8601. */
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

export interface CourseInstructorDetail extends Omit<InstructorSummary, "id"> {
  id: string;
  bio: string | null;
  ratingCount: number;
}

export interface CourseDetail extends CourseSummary {
  description: string;
  learningObjectives: string[];
  prerequisites: string[];
  publishedAt: string | null;
  sections: CurriculumSection[];
  instructorProfile: CourseInstructorDetail | null;
  reviews: CourseReview[];
}
