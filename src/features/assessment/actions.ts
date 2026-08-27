"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { assertAuth, assertCourseOwnership, AuthorizationError } from "@/server/authz";
import { routes } from "@/lib/routes";
import { recordProgress } from "@/features/learning/progress";
import { notify } from "@/features/engagement/notify";
import { recordEngagement } from "@/features/engagement/badges";
import { submitAttempt as gradeAttempt, type GradedAttempt } from "@/features/assessment/grading";

/**
 * Assessment mutations.
 *
 * Every action here re-derives who the caller is and what they may touch. None
 * of them accept a score, a pass/fail flag, or a permission claim from the
 * client — those are computed or looked up server-side without exception.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

function fail(message: string): ActionResult<never> {
  return { ok: false, message };
}

/** Confirms an active enrolment in the course a lesson belongs to. */
async function assertEnrolledInLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      courseId: true,
      course: { select: { slug: true, status: true, deletedAt: true } },
    },
  });

  if (!lesson || lesson.course.deletedAt || lesson.course.status !== "PUBLISHED") return null;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.courseId } },
    select: { status: true, expiresAt: true },
  });

  const usable =
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date());

  return usable ? lesson : null;
}

/* ========================================================================== */
/*  Quiz — student                                                            */
/* ========================================================================== */

export async function startQuizAttemptAction(input: {
  lessonId: string;
}): Promise<ActionResult<{ attemptId: string }>> {
  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("Sign in to take this quiz.");
    throw error;
  }

  const lesson = await assertEnrolledInLesson(user.id, input.lessonId);
  if (!lesson) return fail("You are not enrolled in this course.");

  const quiz = await db.quiz.findUnique({
    where: { lessonId: input.lessonId },
    select: { id: true, maxAttempts: true, _count: { select: { questions: true } } },
  });

  if (!quiz) return fail("This lesson has no quiz.");
  if (quiz._count.questions === 0) return fail("This quiz has no questions yet.");

  const existing = await db.quizAttempt.findFirst({
    where: { quizId: quiz.id, userId: user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });

  // Resuming rather than starting a second attempt. Otherwise a refresh would
  // leave orphaned in-progress rows and eat the attempt allowance.
  if (existing) return { ok: true, data: { attemptId: existing.id } };

  const graded = await db.quizAttempt.count({
    where: { quizId: quiz.id, userId: user.id, status: "GRADED" },
  });

  // The attempt limit is enforced here, on the server, from the stored count.
  if (quiz.maxAttempts !== null && graded >= quiz.maxAttempts) {
    return fail("You have used all your attempts for this quiz.");
  }

  const attempt = await db.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: user.id,
      status: "IN_PROGRESS",
      attemptNumber: graded + 1,
    },
    select: { id: true },
  });

  return { ok: true, data: { attemptId: attempt.id } };
}

const submitSchema = z.object({
  attemptId: z.string().min(1),
  courseSlug: z.string().min(1),
  lessonId: z.string().min(1),
  /** questionId -> option ids. The only thing the client gets to decide. */
  answers: z.record(z.string(), z.array(z.string()).max(20)),
});

export async function submitQuizAttemptAction(
  input: z.infer<typeof submitSchema>,
): Promise<ActionResult<GradedAttempt>> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return fail("That submission was not valid.");

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("Sign in to submit this quiz.");
    throw error;
  }

  const outcome = await gradeAttempt({
    attemptId: parsed.data.attemptId,
    userId: user.id,
    answers: parsed.data.answers,
  });

  if (!outcome.ok) {
    if (outcome.reason === "already_submitted") return fail("This attempt was already submitted.");
    return fail("That attempt could not be graded.");
  }

  // Passing the quiz completes the lesson. Failing does not — that would let a
  // learner satisfy a completion requirement by getting everything wrong.
  if (outcome.result.passed) {
    await recordProgress({
      userId: user.id,
      lessonId: parsed.data.lessonId,
      completed: true,
    });
  } else {
    // A failed attempt is still real engagement and still counts as a day of
    // learning, even though it completes nothing.
    await recordEngagement(user.id);
  }

  await notify({
    userId: user.id,
    type: "QUIZ_GRADED",
    title: outcome.result.passed ? "Quiz passed" : "Quiz graded",
    body: `${outcome.result.percent}% — pass mark is ${outcome.result.passingScore}%.`,
    href: routes.learn(parsed.data.courseSlug),
    dedupeKey: `quiz-graded:${parsed.data.attemptId}`,
  });

  revalidatePath(routes.learn(parsed.data.courseSlug));
  return { ok: true, data: outcome.result };
}

/* ========================================================================== */
/*  Assignment — student                                                      */
/* ========================================================================== */

const submissionSchema = z
  .object({
    lessonId: z.string().min(1),
    courseSlug: z.string().min(1),
    submissionText: z.string().trim().max(20_000).optional(),
    submissionUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), {
        message: "Enter a full URL starting with http:// or https://",
      }),
  })
  .refine((data) => Boolean(data.submissionText) || Boolean(data.submissionUrl), {
    message: "Write an answer or attach a link before submitting",
    path: ["submissionText"],
  });

export async function submitAssignmentAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submissionSchema.safeParse({
    lessonId: formData.get("lessonId"),
    courseSlug: formData.get("courseSlug"),
    submissionText: (formData.get("submissionText") as string | null) || undefined,
    submissionUrl: (formData.get("submissionUrl") as string | null) || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("Sign in to submit this assignment.");
    throw error;
  }

  const lesson = await assertEnrolledInLesson(user.id, parsed.data.lessonId);
  if (!lesson) return fail("You are not enrolled in this course.");

  const assignment = await db.assignment.findUnique({
    where: { lessonId: parsed.data.lessonId },
    select: { id: true, allowResubmission: true, allowUrlSubmission: true },
  });

  if (!assignment) return fail("This lesson has no assignment.");
  if (parsed.data.submissionUrl && !assignment.allowUrlSubmission) {
    return fail("This assignment does not accept links.");
  }

  const latest = await db.assignmentSubmission.findFirst({
    where: { assignmentId: assignment.id, userId: user.id },
    orderBy: { attemptNumber: "desc" },
    select: { attemptNumber: true, status: true },
  });

  if (latest) {
    if (latest.status === "APPROVED") return fail("This assignment has already been approved.");
    if (!assignment.allowResubmission && latest.status !== "CHANGES_REQUESTED") {
      return fail("This assignment does not allow resubmission.");
    }
  }

  await db.assignmentSubmission.create({
    data: {
      assignmentId: assignment.id,
      userId: user.id,
      attemptNumber: (latest?.attemptNumber ?? 0) + 1,
      status: "SUBMITTED",
      submissionText: parsed.data.submissionText ?? null,
      submissionUrl: parsed.data.submissionUrl ?? null,
      submittedAt: new Date(),
    },
  });

  // Submitting completes the lesson. Grading is the instructor's judgement and
  // arrives later; waiting for it would strand the learner's progress.
  await recordProgress({ userId: user.id, lessonId: parsed.data.lessonId, completed: true });

  revalidatePath(routes.learn(parsed.data.courseSlug));
  return { ok: true, message: "Submitted for review." };
}

/* ========================================================================== */
/*  Instructor — grading                                                      */
/* ========================================================================== */

const gradeSchema = z.object({
  submissionId: z.string().min(1),
  score: z.coerce.number().int().min(0).max(100_000),
  feedback: z.string().trim().max(10_000).optional(),
  status: z.enum(["APPROVED", "CHANGES_REQUESTED", "IN_REVIEW"]),
});

export async function gradeSubmissionAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = gradeSchema.safeParse({
    submissionId: formData.get("submissionId"),
    score: formData.get("score"),
    feedback: (formData.get("feedback") as string | null) || undefined,
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("Sign in to grade submissions.");
    throw error;
  }

  const submission = await db.assignmentSubmission.findUnique({
    where: { id: parsed.data.submissionId },
    select: {
      id: true,
      userId: true,
      assignment: {
        select: {
          maxPoints: true,
          lesson: { select: { courseId: true, course: { select: { slug: true } } } },
        },
      },
    },
  });

  if (!submission) return fail("That submission does not exist.");

  // The real permission check: a row in `course_instructors` joining this user
  // to *this* course. Holding the INSTRUCTOR role grants nothing on its own.
  try {
    await assertCourseOwnership(submission.assignment.lesson.courseId, user.id);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return fail("You do not teach this course.");
    }
    throw error;
  }

  // The score is bounded by the assignment's own maximum, not by whatever the
  // form posted.
  if (parsed.data.score > submission.assignment.maxPoints) {
    return {
      ok: false,
      message: `Score cannot exceed ${submission.assignment.maxPoints}.`,
      fieldErrors: { score: [`Maximum is ${submission.assignment.maxPoints}`] },
    };
  }

  await db.$transaction([
    db.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        score: parsed.data.score,
        feedback: parsed.data.feedback ?? null,
        status: parsed.data.status,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: {
        actorId: user.id,
        action: "UPDATE",
        entityType: "AssignmentSubmission",
        entityId: submission.id,
        metadata: { event: "graded", score: parsed.data.score, status: parsed.data.status },
      },
    }),
  ]);

  await notify({
    userId: submission.userId,
    type: "ASSIGNMENT_REVIEWED",
    title:
      parsed.data.status === "APPROVED"
        ? "Assignment approved"
        : parsed.data.status === "CHANGES_REQUESTED"
          ? "Changes requested on your assignment"
          : "Your assignment was reviewed",
    body: `${parsed.data.score}/${submission.assignment.maxPoints}${
      parsed.data.feedback ? ` — ${parsed.data.feedback.slice(0, 120)}` : ""
    }`,
    href: routes.learn(submission.assignment.lesson.course.slug),
    // Keyed on the review, so re-grading the same submission notifies again.
    dedupeKey: `graded:${submission.id}:${Date.now()}`,
  });

  revalidatePath(routes.studioSubmissions);
  revalidatePath(routes.learn(submission.assignment.lesson.course.slug));
  return { ok: true, message: "Grade saved." };
}

/* ========================================================================== */
/*  Instructor — quiz authoring                                               */
/* ========================================================================== */

const questionSchema = z.object({
  prompt: z.string().trim().min(1, "Write a question").max(2000),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
  points: z.coerce.number().int().min(1).max(100),
  explanation: z.string().trim().max(2000).optional(),
  options: z
    .array(
      z.object({
        text: z.string().trim().min(1, "Every option needs text").max(500),
        isCorrect: z.boolean(),
      }),
    )
    .min(2, "A question needs at least two options")
    .max(10),
});

const quizSchema = z.object({
  lessonId: z.string().min(1),
  title: z.string().trim().min(1, "Give the quiz a title").max(200),
  description: z.string().trim().max(2000).optional(),
  passingScore: z.coerce.number().int().min(0).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(50).nullable(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(600).nullable(),
  shuffleQuestions: z.boolean(),
  questions: z.array(questionSchema).min(1, "Add at least one question").max(100),
});

export type QuizAuthoringInput = z.infer<typeof quizSchema>;

/**
 * Creates or replaces a quiz.
 *
 * Questions are replaced wholesale rather than diffed. That is a deliberate
 * simplification with a real consequence, enforced below: a quiz that has
 * already been attempted cannot be restructured, because deleting a question
 * would cascade away the answers behind someone's recorded score.
 */
export async function saveQuizAction(
  input: QuizAuthoringInput,
): Promise<ActionResult<{ quizId: string }>> {
  const parsed = quizSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the quiz for errors.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  for (const [index, question] of parsed.data.questions.entries()) {
    const correct = question.options.filter((option) => option.isCorrect).length;
    if (correct === 0) {
      return fail(`Question ${index + 1} has no correct answer marked.`);
    }
    if (question.type !== "MULTIPLE_CHOICE" && correct > 1) {
      return fail(`Question ${index + 1} allows only one correct answer.`);
    }
  }

  let user;
  try {
    user = await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("Sign in to edit this quiz.");
    throw error;
  }

  const lesson = await db.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: { id: true, courseId: true, type: true, course: { select: { slug: true } } },
  });

  if (!lesson) return fail("That lesson does not exist.");
  if (lesson.type !== "QUIZ") return fail("That lesson is not a quiz lesson.");

  try {
    await assertCourseOwnership(lesson.courseId, user.id);
  } catch (error) {
    if (error instanceof AuthorizationError) return fail("You do not teach this course.");
    throw error;
  }

  const existing = await db.quiz.findUnique({
    where: { lessonId: lesson.id },
    select: { id: true, _count: { select: { attempts: true } } },
  });

  if (existing && existing._count.attempts > 0) {
    return fail(
      "This quiz has already been attempted, so its questions cannot be changed. Settings can still be edited.",
    );
  }

  const quizId = await db.$transaction(async (tx) => {
    const quiz = await tx.quiz.upsert({
      where: { lessonId: lesson.id },
      create: {
        lessonId: lesson.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        passingScore: parsed.data.passingScore,
        maxAttempts: parsed.data.maxAttempts,
        timeLimitMinutes: parsed.data.timeLimitMinutes,
        shuffleQuestions: parsed.data.shuffleQuestions,
      },
      update: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        passingScore: parsed.data.passingScore,
        maxAttempts: parsed.data.maxAttempts,
        timeLimitMinutes: parsed.data.timeLimitMinutes,
        shuffleQuestions: parsed.data.shuffleQuestions,
      },
      select: { id: true },
    });

    await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });

    for (const [index, question] of parsed.data.questions.entries()) {
      await tx.quizQuestion.create({
        data: {
          quizId: quiz.id,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          explanation: question.explanation ?? null,
          position: index,
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

    return quiz.id;
  });

  revalidatePath(routes.studioQuizzes);
  revalidatePath(routes.learn(lesson.course.slug));
  return { ok: true, message: "Quiz saved.", data: { quizId } };
}
