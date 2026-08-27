import type { Metadata } from "next";
import Link from "next/link";

import { requireInstructor } from "@/server/authz";
import { db } from "@/server/db";
import { routes } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Instructor studio" };

/**
 * Studio landing. Course authoring is still to come; assessment is live.
 *
 * Two separate checks are in play, which is the point of the page:
 * `requireInstructor()` decides whether you may open the studio at all, and
 * the query below is scoped through the `course_instructors` join so you see
 * only courses you are actually attached to. Holding the INSTRUCTOR role never
 * grants access to another instructor's material.
 */
export default async function StudioPage() {
  const user = await requireInstructor(routes.studio);

  const courses = await db.course.findMany({
    where: { instructors: { some: { userId: user.id } } },
    select: { id: true, title: true, status: true, enrollmentCount: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={6}>
          <PageHeader
            eyebrow="Instructor studio"
            title="Instructor studio"
            description="Course authoring is still to come. Assessment tools are live."
            actions={
              <>
                <Button variant="outline" asChild>
                  <Link href={routes.studioQuizzes}>Quizzes</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={routes.studioSubmissions}>Submissions</Link>
                </Button>
                <Badge variant="accent">{user.role.toLowerCase()}</Badge>
              </>
            }
          />

          {courses.length === 0 ? (
            <EmptyState
              title="No courses attached to this account"
              description="Courses you own will appear here once authoring exists."
            />
          ) : (
            <Stack gap={3}>
              {courses.map((course) => (
                <Card key={course.id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="flex-1 text-sm font-medium">{course.title}</span>
                  <span className="text-sm text-muted-foreground" data-numeric>
                    {course.enrollmentCount} enrolled
                  </span>
                  <Badge variant={course.status === "PUBLISHED" ? "success" : "neutral"}>
                    {course.status.toLowerCase()}
                  </Badge>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
