import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, SquarePen } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireInstructor } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { getAuthorableQuizzes } from "@/features/assessment/queries";

export const metadata: Metadata = {
  title: "Quizzes",
  robots: { index: false, follow: false },
};

/** Quiz lessons across the instructor's own courses. */
export default async function StudioQuizzesPage() {
  const user = await requireInstructor(routes.studioQuizzes);
  const quizzes = await getAuthorableQuizzes(user.id, user.role === "ADMIN");

  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Instructor studio"
            title="Quizzes"
            description="Every quiz lesson in the courses you teach."
          />

          {quizzes.length === 0 ? (
            <EmptyState
              icon={<ListChecks aria-hidden="true" />}
              title="No quiz lessons yet"
              description="Add a lesson of type Quiz to one of your courses and it will appear here."
            />
          ) : (
            <Stack gap={3}>
              {quizzes.map((quiz) => (
                <Card key={quiz.lessonId} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{quiz.lessonTitle}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {quiz.courseTitle}
                    </span>
                  </div>

                  <span className="text-sm text-muted-foreground" data-numeric>
                    {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
                  </span>

                  {quiz.attemptCount > 0 ? (
                    <Badge variant="warning" size="sm">
                      {quiz.attemptCount} attempt{quiz.attemptCount === 1 ? "" : "s"} · locked
                    </Badge>
                  ) : quiz.quizId ? (
                    <Badge variant="success" size="sm">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      Not built
                    </Badge>
                  )}

                  <Button size="sm" variant="outline" asChild>
                    <Link href={routes.studioQuiz(quiz.lessonId)}>
                      <SquarePen aria-hidden="true" />
                      {quiz.quizId ? "Edit" : "Create"}
                    </Link>
                  </Button>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
