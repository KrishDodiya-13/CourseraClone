import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireAuth, verifyEnrollment } from "@/server/authz";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { LearnShell } from "@/components/learn/learn-shell";
import { getLearningCourse, resolveActiveLesson } from "@/features/learning/queries";

export const metadata: Metadata = {
  title: "Learning",
  robots: { index: false, follow: false },
};

/**
 * The learning surface.
 *
 * Access is enforced twice on purpose. Middleware redirects an unauthenticated
 * visitor away from `/learn/*` before this renders, and `verifyEnrollment`
 * then reads the actual enrolment row — because middleware knows the viewer
 * has *a* session, never that they hold *this* enrolment.
 *
 * The active lesson comes from `?lesson=`, so a specific lesson is linkable
 * and the back button works. Which lesson may open is resolved on the server,
 * so a locked lesson cannot be reached by editing the URL.
 */
export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const [{ courseSlug }, { lesson: requestedLessonId }] = await Promise.all([params, searchParams]);

  const user = await requireAuth(routes.learn(courseSlug));

  const course = await getLearningCourse(courseSlug, user.id, requestedLessonId);
  if (!course) notFound();

  // The real gate: a database read of this user's enrolment in this course.
  await verifyEnrollment(course.id, user.id);

  const activeLesson = resolveActiveLesson(course, requestedLessonId);

  if (!activeLesson) {
    return (
      <Section spacing="lg">
        <Container size="sm">
          <EmptyState
            icon={<BookOpenCheck aria-hidden="true" />}
            title="This course has no lessons yet"
            description="The instructor has not published any lessons. You will keep your enrolment."
            size="lg"
            actions={
              <Button asChild>
                <Link href={routes.course(course.slug)}>Back to course</Link>
              </Button>
            }
          />
        </Container>
      </Section>
    );
  }

  return <LearnShell course={course} activeLesson={activeLesson} />;
}
