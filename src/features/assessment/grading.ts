import "server-only";

import { db } from "@/server/db";

/**
 * Quiz grading.
 *
 * This module exists to hold one rule: **a score is computed here, from the
 * database, and nowhere else.** The client submits option ids and nothing
 * more. It never sends a score, never sends which answers it believes are
 * correct, and never sends whether it thinks it passed — those are all derived
 * below from `QuizOption.isCorrect`, which is read fresh on every submission.
 *
 * A learner who tampers with the request can change which options they
 * selected. That is all. It is indistinguishable from clicking differently.
 */

export interface GradedQuestion {
  questionId: string;
  prompt: string;
  points: number;
  awarded: number;
  correct: boolean;
  /** Option ids the learner picked. */
  selectedOptionIds: string[];
  /** Revealed only after grading. */
  correctOptionIds: string[];
  explanation: string | null;
}

export interface GradedAttempt {
  attemptId: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passingScore: number;
  questions: GradedQuestion[];
}

/**
 * Grades one question.
 *
 * Multiple-choice is all-or-nothing: every correct option must be selected and
 * no incorrect one. Partial credit sounds generous but makes "select
 * everything" a winning strategy on any question with more correct options
 * than wrong ones.
 */
function gradeQuestion(
  correctIds: Set<string>,
  selectedIds: Set<string>,
  points: number,
): { correct: boolean; awarded: number } {
  if (selectedIds.size === 0) return { correct: false, awarded: 0 };
  if (selectedIds.size !== correctIds.size) return { correct: false, awarded: 0 };

  for (const id of correctIds) {
    if (!selectedIds.has(id)) return { correct: false, awarded: 0 };
  }

  return { correct: true, awarded: points };
}

export interface SubmitAnswersInput {
  attemptId: string;
  userId: string;
  /** questionId -> selected option ids. */
  answers: Record<string, string[]>;
}

export type SubmitOutcome =
  | { ok: true; result: GradedAttempt }
  | { ok: false; reason: "not_found" | "not_yours" | "already_submitted" };

/**
 * Grades and persists an attempt.
 *
 * Everything happens in one transaction: answers, score, pass/fail and the
 * attempt's status move together, so a crash mid-grade cannot leave a
 * submitted attempt with no score attached to it.
 */
export async function submitAttempt(input: SubmitAnswersInput): Promise<SubmitOutcome> {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: input.attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      quizId: true,
      quiz: {
        select: {
          passingScore: true,
          questions: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              prompt: true,
              points: true,
              explanation: true,
              options: { select: { id: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt) return { ok: false, reason: "not_found" };
  // Ownership is checked here rather than assumed from the caller — this is
  // the last point before a score is written.
  if (attempt.userId !== input.userId) return { ok: false, reason: "not_yours" };
  if (attempt.status !== "IN_PROGRESS") return { ok: false, reason: "already_submitted" };

  const questions = attempt.quiz.questions;
  const validOptionIds = new Set(
    questions.flatMap((question) => question.options.map((option) => option.id)),
  );

  const graded: GradedQuestion[] = [];
  let score = 0;
  let maxScore = 0;

  for (const question of questions) {
    const correctIds = new Set(
      question.options.filter((option) => option.isCorrect).map((option) => option.id),
    );

    // Submitted ids are filtered against this question's own options, so an
    // id borrowed from another question cannot score anything.
    const selectedIds = new Set(
      (input.answers[question.id] ?? []).filter(
        (id) => validOptionIds.has(id) && question.options.some((option) => option.id === id),
      ),
    );

    const { correct, awarded } = gradeQuestion(correctIds, selectedIds, question.points);

    score += awarded;
    maxScore += question.points;

    graded.push({
      questionId: question.id,
      prompt: question.prompt,
      points: question.points,
      awarded,
      correct,
      selectedOptionIds: [...selectedIds],
      correctOptionIds: [...correctIds],
      explanation: question.explanation,
    });
  }

  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const passed = percent >= attempt.quiz.passingScore;

  await db.$transaction(async (tx) => {
    // Re-check status inside the transaction: two rapid submits must not both
    // write a score.
    const current = await tx.quizAttempt.findUnique({
      where: { id: attempt.id },
      select: { status: true },
    });
    if (current?.status !== "IN_PROGRESS") return;

    await tx.quizAnswer.deleteMany({ where: { attemptId: attempt.id } });

    const rows = graded.flatMap((question) =>
      question.selectedOptionIds.map((optionId) => ({
        attemptId: attempt.id,
        questionId: question.questionId,
        optionId,
        isCorrect: question.correctOptionIds.includes(optionId),
      })),
    );

    if (rows.length > 0) {
      await tx.quizAnswer.createMany({ data: rows });
    }

    await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "GRADED",
        score,
        maxScore,
        passed,
        submittedAt: new Date(),
        gradedAt: new Date(),
      },
    });
  });

  return {
    ok: true,
    result: {
      attemptId: attempt.id,
      score,
      maxScore,
      percent,
      passed,
      passingScore: attempt.quiz.passingScore,
      questions: graded,
    },
  };
}

/** Rebuilds a graded result for the review screen. */
export async function getAttemptResult(
  attemptId: string,
  userId: string,
): Promise<GradedAttempt | null> {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      score: true,
      maxScore: true,
      passed: true,
      quiz: {
        select: {
          passingScore: true,
          questions: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              prompt: true,
              points: true,
              explanation: true,
              options: { select: { id: true, isCorrect: true } },
            },
          },
        },
      },
      answers: { select: { questionId: true, optionId: true } },
    },
  });

  // Correct answers are only ever returned for a *graded* attempt belonging to
  // the caller. An in-progress attempt would otherwise be a way to read the
  // answer key before submitting.
  if (!attempt || attempt.userId !== userId || attempt.status !== "GRADED") return null;

  const selectedByQuestion = new Map<string, string[]>();
  for (const answer of attempt.answers) {
    selectedByQuestion.set(answer.questionId, [
      ...(selectedByQuestion.get(answer.questionId) ?? []),
      answer.optionId,
    ]);
  }

  const questions: GradedQuestion[] = attempt.quiz.questions.map((question) => {
    const correctIds = question.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id);
    const selectedIds = selectedByQuestion.get(question.id) ?? [];
    const { correct, awarded } = gradeQuestion(
      new Set(correctIds),
      new Set(selectedIds),
      question.points,
    );

    return {
      questionId: question.id,
      prompt: question.prompt,
      points: question.points,
      awarded,
      correct,
      selectedOptionIds: selectedIds,
      correctOptionIds: correctIds,
      explanation: question.explanation,
    };
  });

  return {
    attemptId: attempt.id,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percent: attempt.maxScore === 0 ? 0 : Math.round((attempt.score / attempt.maxScore) * 100),
    passed: attempt.passed,
    passingScore: attempt.quiz.passingScore,
    questions,
  };
}

export { gradeQuestion };
