import "server-only";

import { cache } from "react";

import { db } from "@/server/db";

/**
 * Assessment reads.
 *
 * The important thing in this file is what the shapes below *omit*.
 * `QuizOption.isCorrect` never appears in any type a client component
 * receives, and the selects never read it. That is the difference between an
 * answer key that is hidden by the UI and one that was never sent.
 */

/* -------------------------------------------------------------------------- */
/*  Quiz — student view                                                       */
/* -------------------------------------------------------------------------- */

export interface QuizOptionView {
  id: string;
  text: string;
  // Deliberately no `isCorrect`.
}

export interface QuizQuestionView {
  id: string;
  prompt: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  points: number;
  options: QuizOptionView[];
  // Deliberately no `explanation` — it gives the answer away.
}

export interface QuizAttemptSummary {
  id: string;
  attemptNumber: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "ABANDONED";
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  submittedAt: string | null;
}

export interface QuizView {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  description: string | null;
  passingScore: number;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  questionCount: number;
  totalPoints: number;

  /** Prior attempts, newest first. */
  attempts: QuizAttemptSummary[];
  attemptsUsed: number;
  attemptsRemaining: number | null;
  canAttempt: boolean;
  bestPercent: number;
  hasPassed: boolean;
  /** Set when an attempt is open and awaiting submission. */
  activeAttemptId: string | null;
}

function toSummary(row: {
  id: string;
  attemptNumber: number;
  status: string;
  score: number;
  maxScore: number;
  passed: boolean;
  submittedAt: Date | null;
}): QuizAttemptSummary {
  return {
    id: row.id,
    attemptNumber: row.attemptNumber,
    status: row.status as QuizAttemptSummary["status"],
    score: row.score,
    maxScore: row.maxScore,
    percent: row.maxScore === 0 ? 0 : Math.round((row.score / row.maxScore) * 100),
    passed: row.passed,
    submittedAt: row.submittedAt?.toISOString() ?? null,
  };
}

export const getQuizForLesson = cache(
  async (lessonId: string, userId: string): Promise<QuizView | null> => {
    const quiz = await db.quiz.findUnique({
      where: { lessonId },
      select: {
        id: true,
        lessonId: true,
        title: true,
        description: true,
        passingScore: true,
        maxAttempts: true,
        timeLimitMinutes: true,
        lesson: { select: { courseId: true } },
        questions: { select: { points: true } },
      },
    });

    if (!quiz) return null;

    const attempts = await db.quizAttempt.findMany({
      where: { quizId: quiz.id, userId },
      orderBy: { attemptNumber: "desc" },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        score: true,
        maxScore: true,
        passed: true,
        submittedAt: true,
      },
    });

    const summaries = attempts.map(toSummary);
    const finished = summaries.filter((attempt) => attempt.status === "GRADED");
    const active = summaries.find((attempt) => attempt.status === "IN_PROGRESS");

    // An in-progress attempt does not count against the limit until it is
    // submitted — otherwise a lost connection silently burns a retry.
    const attemptsUsed = finished.length;
    const attemptsRemaining =
      quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - attemptsUsed);

    return {
      id: quiz.id,
      lessonId: quiz.lessonId,
      courseId: quiz.lesson.courseId,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      timeLimitMinutes: quiz.timeLimitMinutes,
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0),
      attempts: summaries,
      attemptsUsed,
      attemptsRemaining,
      canAttempt:
        quiz.questions.length > 0 &&
        (Boolean(active) || attemptsRemaining === null || attemptsRemaining > 0),
      bestPercent: finished.reduce((best, attempt) => Math.max(best, attempt.percent), 0),
      hasPassed: finished.some((attempt) => attempt.passed),
      activeAttemptId: active?.id ?? null,
    };
  },
);

/**
 * Questions for an open attempt.
 *
 * Returns null unless the attempt belongs to this user and is still in
 * progress, so the question list cannot be pulled for someone else's attempt
 * or replayed after grading.
 */
export async function getAttemptQuestions(
  attemptId: string,
  userId: string,
): Promise<QuizQuestionView[] | null> {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      userId: true,
      status: true,
      quiz: {
        select: {
          shuffleQuestions: true,
          questions: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              prompt: true,
              type: true,
              points: true,
              // `isCorrect` is not selected. Neither is `explanation`.
              options: { orderBy: { position: "asc" }, select: { id: true, text: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId || attempt.status !== "IN_PROGRESS") return null;

  const questions = attempt.quiz.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    type: question.type as QuizQuestionView["type"],
    points: question.points,
    options: question.options,
  }));

  return attempt.quiz.shuffleQuestions ? shuffle(questions) : questions;
}

/** Fisher-Yates. Order is randomised per attempt, not per render. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!;
    const b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

/* -------------------------------------------------------------------------- */
/*  Assignment — student view                                                 */
/* -------------------------------------------------------------------------- */

export interface SubmissionView {
  id: string;
  attemptNumber: number;
  status: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "CHANGES_REQUESTED";
  submissionText: string | null;
  submissionUrl: string | null;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
}

export interface AssignmentView {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  instructions: string;
  rubric: string | null;
  maxPoints: number;
  allowResubmission: boolean;
  allowUrlSubmission: boolean;
  allowFileUpload: boolean;
  submissions: SubmissionView[];
  latest: SubmissionView | null;
  canSubmit: boolean;
}

export const getAssignmentForLesson = cache(
  async (lessonId: string, userId: string): Promise<AssignmentView | null> => {
    const assignment = await db.assignment.findUnique({
      where: { lessonId },
      select: {
        id: true,
        lessonId: true,
        title: true,
        instructions: true,
        rubric: true,
        maxPoints: true,
        allowResubmission: true,
        allowUrlSubmission: true,
        allowFileUpload: true,
        lesson: { select: { courseId: true } },
        submissions: {
          where: { userId },
          orderBy: { attemptNumber: "desc" },
          select: {
            id: true,
            attemptNumber: true,
            status: true,
            submissionText: true,
            submissionUrl: true,
            score: true,
            feedback: true,
            submittedAt: true,
            reviewedAt: true,
            reviewedBy: { select: { name: true } },
          },
        },
      },
    });

    if (!assignment) return null;

    const submissions: SubmissionView[] = assignment.submissions.map((row) => ({
      id: row.id,
      attemptNumber: row.attemptNumber,
      status: row.status as SubmissionView["status"],
      submissionText: row.submissionText,
      submissionUrl: row.submissionUrl,
      score: row.score,
      feedback: row.feedback,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewerName: row.reviewedBy?.name ?? null,
    }));

    const latest = submissions[0] ?? null;

    // A resubmission is allowed while nothing has been approved, and only when
    // the assignment permits it.
    const canSubmit =
      latest === null ||
      (assignment.allowResubmission && latest.status !== "APPROVED") ||
      latest.status === "CHANGES_REQUESTED";

    return {
      id: assignment.id,
      lessonId: assignment.lessonId,
      courseId: assignment.lesson.courseId,
      title: assignment.title,
      instructions: assignment.instructions,
      rubric: assignment.rubric,
      maxPoints: assignment.maxPoints,
      allowResubmission: assignment.allowResubmission,
      allowUrlSubmission: assignment.allowUrlSubmission,
      allowFileUpload: assignment.allowFileUpload,
      submissions,
      latest,
      canSubmit,
    };
  },
);

/* -------------------------------------------------------------------------- */
/*  Instructor views                                                          */
/* -------------------------------------------------------------------------- */

export interface GradingQueueItem {
  submissionId: string;
  status: SubmissionView["status"];
  attemptNumber: number;
  submittedAt: string | null;
  submissionText: string | null;
  submissionUrl: string | null;
  score: number | null;
  feedback: string | null;
  maxPoints: number;
  learnerName: string;
  learnerEmail: string;
  assignmentTitle: string;
  courseTitle: string;
  courseId: string;
}

/**
 * Submissions across every course this instructor teaches.
 *
 * Scoped through `course_instructors`, so holding the INSTRUCTOR role shows
 * nothing on its own — an instructor sees only work submitted to their own
 * courses. Admins get everything, for moderation.
 */
export async function getGradingQueue(
  userId: string,
  isAdmin: boolean,
): Promise<GradingQueueItem[]> {
  const rows = await db.assignmentSubmission.findMany({
    where: {
      status: { in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"] },
      ...(isAdmin
        ? {}
        : {
            assignment: {
              lesson: { course: { instructors: { some: { userId } } } },
            },
          }),
    },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      attemptNumber: true,
      submittedAt: true,
      submissionText: true,
      submissionUrl: true,
      score: true,
      feedback: true,
      user: { select: { name: true, email: true } },
      assignment: {
        select: {
          title: true,
          maxPoints: true,
          lesson: { select: { course: { select: { id: true, title: true } } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    submissionId: row.id,
    status: row.status as SubmissionView["status"],
    attemptNumber: row.attemptNumber,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    submissionText: row.submissionText,
    submissionUrl: row.submissionUrl,
    score: row.score,
    feedback: row.feedback,
    maxPoints: row.assignment.maxPoints,
    learnerName: row.user.name,
    learnerEmail: row.user.email,
    assignmentTitle: row.assignment.title,
    courseTitle: row.assignment.lesson.course.title,
    courseId: row.assignment.lesson.course.id,
  }));
}

/** Quiz lessons across the instructor's courses, for the authoring list. */
export async function getAuthorableQuizzes(userId: string, isAdmin: boolean) {
  const lessons = await db.lesson.findMany({
    where: {
      type: "QUIZ",
      ...(isAdmin ? {} : { course: { instructors: { some: { userId } } } }),
    },
    orderBy: [{ courseId: "asc" }, { position: "asc" }],
    select: {
      id: true,
      title: true,
      course: { select: { id: true, title: true, slug: true } },
      quiz: {
        select: {
          id: true,
          title: true,
          passingScore: true,
          maxAttempts: true,
          _count: { select: { questions: true, attempts: true } },
        },
      },
    },
  });

  return lessons.map((lesson) => ({
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    courseId: lesson.course.id,
    courseTitle: lesson.course.title,
    courseSlug: lesson.course.slug,
    quizId: lesson.quiz?.id ?? null,
    quizTitle: lesson.quiz?.title ?? null,
    passingScore: lesson.quiz?.passingScore ?? 70,
    maxAttempts: lesson.quiz?.maxAttempts ?? null,
    questionCount: lesson.quiz?._count.questions ?? 0,
    attemptCount: lesson.quiz?._count.attempts ?? 0,
  }));
}

/**
 * The full quiz, answer key included, for the authoring screen.
 *
 * This is the one read that returns `isCorrect` — and it is gated on course
 * ownership by its caller before it is ever invoked.
 */
export async function getQuizForAuthoring(lessonId: string) {
  return db.quiz.findUnique({
    where: { lessonId },
    select: {
      id: true,
      lessonId: true,
      title: true,
      description: true,
      passingScore: true,
      maxAttempts: true,
      timeLimitMinutes: true,
      shuffleQuestions: true,
      lesson: { select: { title: true, courseId: true, course: { select: { title: true } } } },
      questions: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          prompt: true,
          type: true,
          points: true,
          explanation: true,
          position: true,
          options: {
            orderBy: { position: "asc" },
            select: { id: true, text: true, isCorrect: true, position: true },
          },
        },
      },
    },
  });
}
