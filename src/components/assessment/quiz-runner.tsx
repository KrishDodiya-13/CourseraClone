"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, CircleX, ListChecks, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/states/empty-state";
import { toast } from "@/components/ui/toast";
import { startQuizAttemptAction, submitQuizAttemptAction } from "@/features/assessment/actions";
import type { GradedAttempt } from "@/features/assessment/grading";
import type { QuizQuestionView, QuizView } from "@/features/assessment/queries";

/**
 * Quiz runner.
 *
 * Worth noting what this component cannot do. It never receives which options
 * are correct, so it cannot mark anything itself; it posts option ids and
 * renders whatever the server sends back. Tampering with its state changes
 * which answers get submitted and nothing else — the same as clicking
 * differently.
 */
function QuizRunner({
  quiz,
  courseSlug,
  initialResult,
}: {
  quiz: QuizView;
  courseSlug: string;
  /** A previous graded attempt, for the review screen. */
  initialResult?: GradedAttempt | null;
}) {
  const router = useRouter();

  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<QuizQuestionView[] | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string[]>>({});
  const [result, setResult] = React.useState<GradedAttempt | null>(initialResult ?? null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStart() {
    setBusy(true);
    setError(null);
    setResult(null);

    const started = await startQuizAttemptAction({ lessonId: quiz.lessonId });
    if (!started.ok || !started.data) {
      setError(started.message ?? "This quiz could not be started.");
      setBusy(false);
      return;
    }

    // Questions are fetched for this attempt specifically, so the answer key
    // is never part of the page payload.
    const response = await fetch(
      `/api/learn/quiz/questions?attemptId=${encodeURIComponent(started.data.attemptId)}`,
      { credentials: "same-origin" },
    );

    if (!response.ok) {
      setError("The questions could not be loaded.");
      setBusy(false);
      return;
    }

    setAttemptId(started.data.attemptId);
    setQuestions((await response.json()) as QuizQuestionView[]);
    setAnswers({});
    setBusy(false);
  }

  function toggleOption(question: QuizQuestionView, optionId: string) {
    setAnswers((current) => {
      const selected = current[question.id] ?? [];
      if (question.type === "MULTIPLE_CHOICE") {
        return {
          ...current,
          [question.id]: selected.includes(optionId)
            ? selected.filter((id) => id !== optionId)
            : [...selected, optionId],
        };
      }
      // Single choice and true/false replace rather than accumulate.
      return { ...current, [question.id]: [optionId] };
    });
  }

  async function handleSubmit() {
    if (!attemptId) return;
    setBusy(true);
    setError(null);

    const outcome = await submitQuizAttemptAction({
      attemptId,
      courseSlug,
      lessonId: quiz.lessonId,
      answers,
    });

    setBusy(false);

    if (!outcome.ok || !outcome.data) {
      setError(outcome.message ?? "That could not be submitted.");
      return;
    }

    setResult(outcome.data);
    setQuestions(null);
    setAttemptId(null);
    toast[outcome.data.passed ? "success" : "error"](
      outcome.data.passed ? "Quiz passed" : "Not passed this time",
      { description: `${outcome.data.percent}% — pass mark is ${outcome.data.passingScore}%.` },
    );
    router.refresh();
  }

  const answeredCount = questions
    ? questions.filter((question) => (answers[question.id] ?? []).length > 0).length
    : 0;

  /* --- results ---------------------------------------------------------- */
  if (result) {
    return (
      <QuizResults
        result={result}
        quiz={quiz}
        onRetry={quiz.canAttempt ? () => void handleStart() : undefined}
        busy={busy}
      />
    );
  }

  /* --- taking ----------------------------------------------------------- */
  if (questions && attemptId) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="primary">Attempt in progress</Badge>
          <span className="text-sm text-muted-foreground" data-numeric>
            {answeredCount} of {questions.length} answered
          </span>
        </div>

        <ol className="flex flex-col gap-5">
          {questions.map((question, index) => {
            const selected = answers[question.id] ?? [];
            const multiple = question.type === "MULTIPLE_CHOICE";

            return (
              <li key={question.id}>
                <fieldset className="flex flex-col gap-3">
                  <legend className="flex flex-wrap items-baseline gap-2 pb-1">
                    <span className="font-mono text-2xs text-muted-foreground" data-numeric>
                      {index + 1}
                    </span>
                    <span className="text-base font-medium">{question.prompt}</span>
                    <span className="text-sm text-muted-foreground" data-numeric>
                      · {question.points} {question.points === 1 ? "point" : "points"}
                    </span>
                    {multiple ? (
                      <Badge variant="neutral" size="sm">
                        Select all that apply
                      </Badge>
                    ) : null}
                  </legend>

                  {question.options.map((option) => {
                    const checked = selected.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary-subtle"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <input
                          type={multiple ? "checkbox" : "radio"}
                          name={question.id}
                          checked={checked}
                          onChange={() => toggleOption(question, option.id)}
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                        />
                        <span>{option.text}</span>
                      </label>
                    );
                  })}
                </fieldset>
              </li>
            );
          })}
        </ol>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {answeredCount < questions.length
              ? `${questions.length - answeredCount} unanswered — they will score zero.`
              : "All questions answered."}
          </p>
          <Button onClick={() => void handleSubmit()} isLoading={busy} loadingText="Grading">
            Submit answers
          </Button>
        </div>
      </div>
    );
  }

  /* --- start screen ----------------------------------------------------- */
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{quiz.title}</h3>
        {quiz.description ? (
          <p className="text-sm text-muted-foreground">{quiz.description}</p>
        ) : null}
      </div>

      <dl className="grid gap-4 sm:grid-cols-4">
        <Fact label="Questions" value={String(quiz.questionCount)} />
        <Fact label="Pass mark" value={`${quiz.passingScore}%`} />
        <Fact
          label="Attempts"
          value={
            quiz.maxAttempts === null ? "Unlimited" : `${quiz.attemptsUsed} of ${quiz.maxAttempts}`
          }
        />
        <Fact label="Best score" value={quiz.attemptsUsed > 0 ? `${quiz.bestPercent}%` : "—"} />
      </dl>

      {quiz.attempts.length > 0 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <h4 className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
              Previous attempts
            </h4>
            <ul className="flex flex-col gap-1.5">
              {quiz.attempts
                .filter((attempt) => attempt.status === "GRADED")
                .map((attempt) => (
                  <li
                    key={attempt.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className="text-muted-foreground" data-numeric>
                      Attempt {attempt.attemptNumber}
                    </span>
                    <span className="flex-1 font-medium" data-numeric>
                      {attempt.percent}%
                    </span>
                    <Badge variant={attempt.passed ? "success" : "danger"} size="sm">
                      {attempt.passed ? "Passed" : "Not passed"}
                    </Badge>
                  </li>
                ))}
            </ul>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {quiz.questionCount === 0 ? (
        <EmptyState
          icon={<ListChecks aria-hidden="true" />}
          title="This quiz has no questions yet"
          description="The instructor has not finished building it."
        />
      ) : quiz.canAttempt ? (
        <Button onClick={() => void handleStart()} isLoading={busy} loadingText="Starting">
          {quiz.attemptsUsed > 0 ? "Try again" : "Start quiz"}
        </Button>
      ) : (
        <EmptyState
          icon={<CircleX aria-hidden="true" />}
          title="No attempts left"
          description={`You have used all ${quiz.maxAttempts} attempts for this quiz.`}
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="font-display text-lg font-semibold" data-numeric>
        {value}
      </dd>
    </div>
  );
}

/**
 * Graded results.
 *
 * Correct answers and explanations appear here and only here — after grading,
 * from the server's response.
 */
function QuizResults({
  result,
  quiz,
  onRetry,
  busy,
}: {
  result: GradedAttempt;
  quiz: QuizView;
  onRetry?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Card
        variant="muted"
        className={cn(
          "flex flex-wrap items-center gap-4 p-5",
          result.passed ? "border-success/40" : "border-danger/40",
        )}
      >
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full",
            result.passed ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
          )}
        >
          {result.passed ? (
            <CircleCheck className="size-5" aria-hidden="true" />
          ) : (
            <CircleX className="size-5" aria-hidden="true" />
          )}
        </span>

        <div className="flex flex-1 flex-col">
          <p className="font-display text-2xl font-semibold" data-numeric>
            {result.percent}%
          </p>
          <p className="text-sm text-muted-foreground" data-numeric>
            {result.score} of {result.maxScore} points · pass mark {result.passingScore}%
          </p>
        </div>

        <Badge variant={result.passed ? "success" : "danger"}>
          {result.passed ? "Passed" : "Not passed"}
        </Badge>
      </Card>

      <ol className="flex flex-col gap-4">
        {result.questions.map((question, index) => (
          <li key={question.questionId}>
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    question.correct
                      ? "bg-success text-success-foreground"
                      : "bg-danger text-danger-foreground",
                  )}
                >
                  {question.correct ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    <X className="size-3" aria-hidden="true" />
                  )}
                </span>
                <p className="flex-1 text-sm font-medium">
                  <span className="font-mono text-2xs text-muted-foreground" data-numeric>
                    {index + 1}.{" "}
                  </span>
                  {question.prompt}
                </p>
                <span className="shrink-0 text-sm text-muted-foreground" data-numeric>
                  {question.awarded}/{question.points}
                </span>
              </div>

              {!question.correct ? (
                <p className="text-sm text-muted-foreground">
                  <span className="sr-only">Result: </span>
                  {question.selectedOptionIds.length === 0
                    ? "You did not answer this one."
                    : "Your answer was not correct."}
                </p>
              ) : null}

              {question.explanation ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  {question.explanation}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {quiz.maxAttempts === null
            ? "Unlimited attempts"
            : `${quiz.attemptsRemaining ?? 0} attempt${
                quiz.attemptsRemaining === 1 ? "" : "s"
              } remaining`}
        </p>
        {onRetry ? (
          <Button variant="outline" onClick={onRetry} isLoading={busy} loadingText="Starting">
            <RotateCcw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export { QuizRunner, QuizResults };
