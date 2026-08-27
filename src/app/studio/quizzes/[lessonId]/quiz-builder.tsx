"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { saveQuizAction, type QuizAuthoringInput } from "@/features/assessment/actions";

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";

interface DraftOption {
  key: string;
  text: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  key: string;
  prompt: string;
  type: QuestionType;
  points: number;
  explanation: string;
  options: DraftOption[];
}

let counter = 0;
const nextKey = () => `k${(counter += 1)}`;

function blankOption(text = ""): DraftOption {
  return { key: nextKey(), text, isCorrect: false };
}

function blankQuestion(): DraftQuestion {
  return {
    key: nextKey(),
    prompt: "",
    type: "SINGLE_CHOICE",
    points: 1,
    explanation: "",
    options: [blankOption(), blankOption()],
  };
}

export interface QuizBuilderProps {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  /** Locked once anyone has attempted the quiz. */
  hasAttempts: boolean;
  initial: {
    title: string;
    description: string;
    passingScore: number;
    maxAttempts: number | null;
    timeLimitMinutes: number | null;
    shuffleQuestions: boolean;
    questions: Array<{
      prompt: string;
      type: QuestionType;
      points: number;
      explanation: string | null;
      options: Array<{ text: string; isCorrect: boolean }>;
    }>;
  } | null;
}

/**
 * Quiz builder.
 *
 * Correct answers are set here and travel to the server, which stores them on
 * `QuizOption.isCorrect`. They never travel back out to a learner — the
 * student-facing query does not select the column at all.
 *
 * Structural edits are blocked once a quiz has been attempted: deleting a
 * question would cascade away the answers behind someone's recorded score.
 * That is enforced in the action, and surfaced here so it is not a surprise.
 */
function QuizBuilder({
  lessonId,
  lessonTitle,
  courseTitle,
  hasAttempts,
  initial,
}: QuizBuilderProps) {
  const router = useRouter();

  const [title, setTitle] = React.useState(initial?.title ?? lessonTitle);
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [passingScore, setPassingScore] = React.useState(initial?.passingScore ?? 70);
  const [maxAttempts, setMaxAttempts] = React.useState<string>(
    initial?.maxAttempts === null || initial?.maxAttempts === undefined
      ? ""
      : String(initial.maxAttempts),
  );
  const [timeLimit, setTimeLimit] = React.useState<string>(
    initial?.timeLimitMinutes === null || initial?.timeLimitMinutes === undefined
      ? ""
      : String(initial.timeLimitMinutes),
  );
  const [shuffle, setShuffle] = React.useState(initial?.shuffleQuestions ?? false);

  const [questions, setQuestions] = React.useState<DraftQuestion[]>(() =>
    initial && initial.questions.length > 0
      ? initial.questions.map((question) => ({
          key: nextKey(),
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          explanation: question.explanation ?? "",
          options: question.options.map((option) => ({
            key: nextKey(),
            text: option.text,
            isCorrect: option.isCorrect,
          })),
        }))
      : [blankQuestion()],
  );

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question) => (question.key === key ? { ...question, ...patch } : question)),
    );
  }

  function setQuestionType(key: string, type: QuestionType) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.key !== key) return question;

        if (type === "TRUE_FALSE") {
          return {
            ...question,
            type,
            options: [
              { key: nextKey(), text: "True", isCorrect: question.options[0]?.isCorrect ?? false },
              { key: nextKey(), text: "False", isCorrect: false },
            ],
          };
        }

        // Moving away from multi-select leaves at most one correct answer.
        if (type !== "MULTIPLE_CHOICE") {
          let seen = false;
          return {
            ...question,
            type,
            options: question.options.map((option) => {
              if (option.isCorrect && !seen) {
                seen = true;
                return option;
              }
              return { ...option, isCorrect: false };
            }),
          };
        }

        return { ...question, type };
      }),
    );
  }

  function toggleCorrect(questionKey: string, optionKey: string) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.key !== questionKey) return question;
        const multiple = question.type === "MULTIPLE_CHOICE";
        return {
          ...question,
          options: question.options.map((option) => {
            if (option.key === optionKey) return { ...option, isCorrect: !option.isCorrect };
            return multiple ? option : { ...option, isCorrect: false };
          }),
        };
      }),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const payload: QuizAuthoringInput = {
      lessonId,
      title,
      description: description || undefined,
      passingScore,
      maxAttempts: maxAttempts === "" ? null : Number(maxAttempts),
      timeLimitMinutes: timeLimit === "" ? null : Number(timeLimit),
      shuffleQuestions: shuffle,
      questions: questions.map((question) => ({
        prompt: question.prompt,
        type: question.type,
        points: question.points,
        explanation: question.explanation || undefined,
        options: question.options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      })),
    };

    const result = await saveQuizAction(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.message ?? "The quiz could not be saved.");
      return;
    }

    toast.success("Quiz saved");
    router.refresh();
  }

  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);

  return (
    <div className="flex flex-col gap-6">
      {hasAttempts ? (
        <Card variant="muted" className="border-warning/40 p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">This quiz has been attempted.</strong> Questions can
            no longer be changed — deleting one would remove the answers behind a learner&rsquo;s
            recorded score. Create a new quiz lesson if you need a different set of questions.
          </p>
        </Card>
      ) : null}

      {/* --- settings ---------------------------------------------------- */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Badge variant="neutral" size="sm">
            {courseTitle}
          </Badge>
        </div>

        <Field>
          <FieldLabel>Quiz title</FieldLabel>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>

        <Field>
          <FieldLabel>Description</FieldLabel>
          <Textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this checkpoint covers."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>Pass mark (%)</FieldLabel>
            <Input
              type="number"
              min={0}
              max={100}
              value={passingScore}
              onChange={(event) => setPassingScore(Number(event.target.value))}
            />
          </Field>

          <Field>
            <FieldLabel>Max attempts</FieldLabel>
            <Input
              type="number"
              min={1}
              max={50}
              value={maxAttempts}
              onChange={(event) => setMaxAttempts(event.target.value)}
              placeholder="Unlimited"
            />
            <FieldDescription>Leave blank for unlimited.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Time limit (minutes)</FieldLabel>
            <Input
              type="number"
              min={1}
              max={600}
              value={timeLimit}
              onChange={(event) => setTimeLimit(event.target.value)}
              placeholder="None"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(event) => setShuffle(event.target.checked)}
            className="size-4 accent-primary"
          />
          Shuffle question order for each attempt
        </label>
      </Card>

      {/* --- questions --------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Questions
          <span className="ml-2 text-sm font-normal text-muted-foreground" data-numeric>
            {questions.length} · {totalPoints} points
          </span>
        </h2>
        {!hasAttempts ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuestions((current) => [...current, blankQuestion()])}
          >
            <Plus aria-hidden="true" />
            Add question
          </Button>
        ) : null}
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => (
          <li key={question.key}>
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <GripVertical
                  className="mt-2 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <Field>
                    <FieldLabel>Question {index + 1}</FieldLabel>
                    <Textarea
                      rows={2}
                      value={question.prompt}
                      disabled={hasAttempts}
                      onChange={(event) =>
                        updateQuestion(question.key, { prompt: event.target.value })
                      }
                      placeholder="What do you want to check?"
                    />
                  </Field>
                </div>
                {questions.length > 1 && !hasAttempts ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() =>
                      setQuestions((current) =>
                        current.filter((entry) => entry.key !== question.key),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Type</FieldLabel>
                  <Select
                    value={question.type}
                    disabled={hasAttempts}
                    onValueChange={(value) => setQuestionType(question.key, value as QuestionType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE_CHOICE">Single choice</SelectItem>
                      <SelectItem value="MULTIPLE_CHOICE">Select all that apply</SelectItem>
                      <SelectItem value="TRUE_FALSE">True or false</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Points</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    disabled={hasAttempts}
                    value={question.points}
                    onChange={(event) =>
                      updateQuestion(question.key, { points: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <p className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                  Options — tick the correct one
                  {question.type === "MULTIPLE_CHOICE" ? "s" : ""}
                </p>

                {question.options.map((option, optionIndex) => (
                  <div key={option.key} className="flex items-center gap-2.5">
                    <label className="flex items-center gap-2">
                      <input
                        type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                        name={`correct-${question.key}`}
                        checked={option.isCorrect}
                        disabled={hasAttempts}
                        onChange={() => toggleCorrect(question.key, option.key)}
                        className="size-4 accent-primary"
                      />
                      <span className="sr-only">Mark option {optionIndex + 1} correct</span>
                    </label>

                    <Input
                      value={option.text}
                      disabled={hasAttempts || question.type === "TRUE_FALSE"}
                      onChange={(event) =>
                        updateQuestion(question.key, {
                          options: question.options.map((entry) =>
                            entry.key === option.key
                              ? { ...entry, text: event.target.value }
                              : entry,
                          ),
                        })
                      }
                      placeholder={`Option ${optionIndex + 1}`}
                      className={cn(option.isCorrect && "border-success")}
                    />

                    {question.options.length > 2 &&
                    question.type !== "TRUE_FALSE" &&
                    !hasAttempts ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove option ${optionIndex + 1}`}
                        onClick={() =>
                          updateQuestion(question.key, {
                            options: question.options.filter((entry) => entry.key !== option.key),
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}

                {question.type !== "TRUE_FALSE" && question.options.length < 10 && !hasAttempts ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      updateQuestion(question.key, {
                        options: [...question.options, blankOption()],
                      })
                    }
                  >
                    <Plus aria-hidden="true" />
                    Add option
                  </Button>
                ) : null}
              </div>

              <Field>
                <FieldLabel>Explanation (optional)</FieldLabel>
                <Textarea
                  rows={2}
                  value={question.explanation}
                  disabled={hasAttempts}
                  onChange={(event) =>
                    updateQuestion(question.key, { explanation: event.target.value })
                  }
                  placeholder="Shown after grading, never before."
                />
              </Field>
            </Card>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-background/90 py-4 backdrop-blur">
        <Button onClick={() => void handleSave()} isLoading={saving} loadingText="Saving">
          Save quiz
        </Button>
      </div>
    </div>
  );
}

export { QuizBuilder };
