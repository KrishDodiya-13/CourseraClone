import type { LessonKind } from "@/features/catalog/types";
import type { AssignmentView, QuizView } from "@/features/assessment/queries";

/**
 * View models for the learning surface.
 *
 * These are what the player and sidebar need — already joined with the
 * viewer's progress, already resolved for lock state. Nothing here is computed
 * in the browser, because lock state and completion are access decisions and
 * belong on the server.
 */

export interface LearnerLesson {
  id: string;
  title: string;
  summary: string | null;
  type: LessonKind;
  durationSeconds: number;
  isFreePreview: boolean;
  /** Counts toward completion. Optional lessons never block a certificate. */
  isRequired: boolean;

  /** Article body — only populated for the lesson currently being viewed. */
  articleContent: string | null;
  /** Downloadable/inline resources for this lesson. */
  resources: LearnerResource[];

  // --- viewer progress ---
  completed: boolean;
  /** Resume point in seconds. */
  positionSeconds: number;
  /**
   * Locked lessons are not navigable and carry no content. Decided on the
   * server from `sequentialProgress` plus the learner's own completions.
   */
  locked: boolean;

  /**
   * Assessment payloads, populated only for the lesson being viewed.
   * The quiz view never contains correct answers — see
   * `features/assessment/queries.ts`.
   */
  quiz: QuizView | null;
  assignment: AssignmentView | null;

  sectionId: string;
  sectionTitle: string;
  /** Position across the whole course, for prev/next and "lesson 4 of 23". */
  index: number;
}

export interface LearnerResource {
  id: string;
  title: string;
  kind: "PDF" | "FILE" | "LINK" | "CODE";
  fileKey: string | null;
  externalUrl: string | null;
  mimeType: string | null;
}

export interface LearnerSection {
  id: string;
  title: string;
  description: string | null;
  lessons: LearnerLesson[];
}

export interface LearnerCourse {
  id: string;
  slug: string;
  title: string;
  sequentialProgress: boolean;

  sections: LearnerSection[];
  /** Flattened, in course order. */
  lessons: LearnerLesson[];

  // --- rolled-up progress ---
  completedLessons: number;
  requiredLessons: number;
  totalLessons: number;
  percent: number;
  /** Where the learner left off, for the resume banner. */
  lastLessonId: string | null;
  isComplete: boolean;

  enrollmentId: string;
  certificateSerial: string | null;
}
