/**
 * Integration check for the assessment security boundary.
 *
 * Asserts the properties that make quiz grading safe to expose:
 *   1. the student-facing question payload contains no `isCorrect`;
 *   2. the score is computed from the database, not from anything submitted;
 *   3. option ids borrowed from another question score nothing;
 *   4. multiple-choice is all-or-nothing, so "select everything" loses;
 *   5. an attempt cannot be graded twice;
 *   6. an attempt belonging to another user cannot be graded.
 *
 * Run: npm run test:assessment
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { submitAttempt } from "../src/features/assessment/grading.js";
import { getAttemptQuestions } from "../src/features/assessment/queries.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}`);
  if (!condition) failures += 1;
}

async function main() {
  const learner = await db.user.findUnique({ where: { email: "wei@coursera.test" } });
  const other = await db.user.findUnique({ where: { email: "amara@coursera.test" } });
  if (!learner || !other) throw new Error("Seed users missing. Run npm run db:seed.");

  const quiz = await db.quiz.findFirst({
    where: { lesson: { course: { slug: "systems-design-foundations" } } },
    include: { questions: { include: { options: true }, orderBy: { position: "asc" } } },
  });
  if (!quiz) throw new Error("Seed quiz missing.");

  // Start from a clean slate for this learner.
  await db.quizAttempt.deleteMany({ where: { quizId: quiz.id, userId: learner.id } });

  console.log("\nQuestion payload");

  const attempt = await db.quizAttempt.create({
    data: { quizId: quiz.id, userId: learner.id, status: "IN_PROGRESS", attemptNumber: 1 },
  });

  const questions = await getAttemptQuestions(attempt.id, learner.id);
  check("questions are returned for the owner", questions !== null);

  const serialised = JSON.stringify(questions);
  // Checked as JSON keys: one seeded question prompt contains the word
  // "explanation" in its text, which is not a leak.
  check("payload has no isCorrect field", !serialised.includes('"isCorrect"'));
  check("payload has no explanation field", !serialised.includes('"explanation"'));
  check("payload has no points-revealing answer key", !serialised.includes('"correctOptionIds"'));

  const foreign = await getAttemptQuestions(attempt.id, other.id);
  check("another user cannot read the questions", foreign === null);

  console.log("\nGrading");

  // --- every answer wrong -------------------------------------------------
  const allWrong: Record<string, string[]> = {};
  for (const question of quiz.questions) {
    const wrong = question.options.find((option) => !option.isCorrect);
    if (wrong) allWrong[question.id] = [wrong.id];
  }

  const wrongOutcome = await submitAttempt({
    attemptId: attempt.id,
    userId: learner.id,
    answers: allWrong,
  });
  check("a wrong-answer attempt grades", wrongOutcome.ok);
  if (wrongOutcome.ok) {
    check("scores zero", wrongOutcome.result.score === 0);
    check("does not pass", wrongOutcome.result.passed === false);
  }

  check(
    "a graded attempt cannot be submitted again",
    !(await submitAttempt({ attemptId: attempt.id, userId: learner.id, answers: allWrong })).ok,
  );

  // --- every answer right -------------------------------------------------
  const attempt2 = await db.quizAttempt.create({
    data: { quizId: quiz.id, userId: learner.id, status: "IN_PROGRESS", attemptNumber: 2 },
  });

  const allRight: Record<string, string[]> = {};
  for (const question of quiz.questions) {
    allRight[question.id] = question.options
      .filter((option) => option.isCorrect)
      .map((option) => option.id);
  }

  const rightOutcome = await submitAttempt({
    attemptId: attempt2.id,
    userId: learner.id,
    answers: allRight,
  });

  if (rightOutcome.ok) {
    const totalPoints = quiz.questions.reduce((sum, question) => sum + question.points, 0);
    check("a correct attempt scores full marks", rightOutcome.result.score === totalPoints);
    check("and passes", rightOutcome.result.passed === true);
    check("percent is 100", rightOutcome.result.percent === 100);
  } else {
    check("a correct attempt grades", false);
  }

  // --- select everything --------------------------------------------------
  const attempt3 = await db.quizAttempt.create({
    data: { quizId: quiz.id, userId: learner.id, status: "IN_PROGRESS", attemptNumber: 3 },
  });

  const selectAll: Record<string, string[]> = {};
  for (const question of quiz.questions) {
    selectAll[question.id] = question.options.map((option) => option.id);
  }

  const greedy = await submitAttempt({
    attemptId: attempt3.id,
    userId: learner.id,
    answers: selectAll,
  });

  if (greedy.ok && rightOutcome.ok) {
    // All-or-nothing marking means a greedy answer only scores on a question
    // where every option happens to be correct — which none of these are.
    const alwaysWinnable = quiz.questions.filter((question) =>
      question.options.every((option) => option.isCorrect),
    );
    const greedyCeiling = alwaysWinnable.reduce((sum, question) => sum + question.points, 0);

    check(
      "selecting every option scores strictly less than answering correctly",
      greedy.result.score < rightOutcome.result.score,
    );
    check(
      "and scores only the questions where every option is correct",
      greedy.result.score === greedyCeiling,
    );
    console.log(
      `      (greedy ${greedy.result.score}/${greedy.result.maxScore}, correct ${rightOutcome.result.score}/${rightOutcome.result.maxScore})`,
    );
  } else {
    check("greedy submission grades", false);
  }

  // --- foreign option ids -------------------------------------------------
  const attempt4 = await db.quizAttempt.create({
    data: { quizId: quiz.id, userId: learner.id, status: "IN_PROGRESS", attemptNumber: 4 },
  });

  const firstQuestion = quiz.questions[0]!;
  const secondQuestion = quiz.questions[1];
  const borrowed = secondQuestion?.options.find((option) => option.isCorrect);

  const forged = await submitAttempt({
    attemptId: attempt4.id,
    userId: learner.id,
    answers: {
      // An option id from a different question, plus one that does not exist.
      [firstQuestion.id]: [borrowed?.id ?? "nope", "not-a-real-option-id"],
    },
  });

  if (forged.ok) {
    check("option ids from another question score nothing", forged.result.score === 0);
  }

  // --- ownership ----------------------------------------------------------
  const attempt5 = await db.quizAttempt.create({
    data: { quizId: quiz.id, userId: learner.id, status: "IN_PROGRESS", attemptNumber: 5 },
  });
  const stolen = await submitAttempt({
    attemptId: attempt5.id,
    userId: other.id,
    answers: allRight,
  });
  check(
    "another user cannot grade someone else's attempt",
    !stolen.ok && stolen.reason === "not_yours",
  );

  console.log("\nPersistence");
  const persisted = await db.quizAttempt.findUnique({
    where: { id: attempt2.id },
    select: {
      score: true,
      maxScore: true,
      passed: true,
      status: true,
      _count: { select: { answers: true } },
    },
  });
  check("the graded attempt is stored", persisted?.status === "GRADED");
  check("with its score", (persisted?.score ?? 0) > 0);
  check("and its individual answers", (persisted?._count.answers ?? 0) > 0);

  // Clean up so the seeded state is not left distorted.
  await db.quizAttempt.deleteMany({ where: { quizId: quiz.id, userId: learner.id } });

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
