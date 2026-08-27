import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { routes } from "@/lib/routes";
import { db } from "@/server/db";
import { requireInstructor, verifyCourseOwnership } from "@/server/authz";
import { Button } from "@/components/ui/button";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { getQuizForAuthoring } from "@/features/assessment/queries";
import { QuizBuilder } from "@/app/studio/quizzes/[lessonId]/quiz-builder";

export const metadata: Metadata = {
  title: "Edit quiz",
  robots: { index: false, follow: false },
};

/**
 * Quiz authoring.
 *
 * Two gates, both server-side. `requireInstructor` decides whether the studio
 * is open at all; `verifyCourseOwnership` then reads the `course_instructors`
 * row for this specific course. Holding the INSTRUCTOR role never grants
 * access to someone else's quiz.
 *
 * This is the only place the answer key is read out of the database.
 */
export default async function QuizBuilderPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const user = await requireInstructor(routes.studioQuizzes);

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      type: true,
      courseId: true,
      course: { select: { title: true } },
    },
  });

  if (!lesson || lesson.type !== "QUIZ") notFound();

  await verifyCourseOwnership(lesson.courseId, user.id);

  const quiz = await getQuizForAuthoring(lessonId);
  const attemptCount = quiz ? await db.quizAttempt.count({ where: { quizId: quiz.id } }) : 0;

  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Instructor studio"
            title={quiz ? "Edit quiz" : "Create quiz"}
            description={`${lesson.course.title} · ${lesson.title}`}
            actions={
              <Button variant="outline" asChild>
                <Link href={routes.studioQuizzes}>
                  <ArrowLeft aria-hidden="true" />
                  All quizzes
                </Link>
              </Button>
            }
          />

          <QuizBuilder
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            courseTitle={lesson.course.title}
            hasAttempts={attemptCount > 0}
            initial={
              quiz
                ? {
                    title: quiz.title,
                    description: quiz.description ?? "",
                    passingScore: quiz.passingScore,
                    maxAttempts: quiz.maxAttempts,
                    timeLimitMinutes: quiz.timeLimitMinutes,
                    shuffleQuestions: quiz.shuffleQuestions,
                    questions: quiz.questions.map((question) => ({
                      prompt: question.prompt,
                      type: question.type,
                      points: question.points,
                      explanation: question.explanation,
                      options: question.options.map((option) => ({
                        text: option.text,
                        isCorrect: option.isCorrect,
                      })),
                    })),
                  }
                : null
            }
          />
        </Stack>
      </Container>
    </Section>
  );
}
