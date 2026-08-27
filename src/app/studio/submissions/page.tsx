import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireInstructor } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { getGradingQueue } from "@/features/assessment/queries";
import { GradingCard } from "@/app/studio/submissions/grading-card";

export const metadata: Metadata = {
  title: "Submissions",
  robots: { index: false, follow: false },
};

/**
 * Grading queue.
 *
 * Scoped through `course_instructors` inside the query, so an instructor sees
 * only work submitted to courses they actually teach — the role check on this
 * page decides whether the studio opens, not what is in it.
 */
export default async function StudioSubmissionsPage() {
  const user = await requireInstructor(routes.studioSubmissions);
  const queue = await getGradingQueue(user.id, user.role === "ADMIN");

  const awaiting = queue.filter(
    (item) => item.status === "SUBMITTED" || item.status === "IN_REVIEW",
  );

  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Instructor studio"
            title="Submissions"
            description="Assignment submissions from learners on your courses."
            actions={
              awaiting.length > 0 ? (
                <Badge variant="warning">{awaiting.length} awaiting review</Badge>
              ) : null
            }
          />

          {queue.length === 0 ? (
            <EmptyState
              icon={<ClipboardList aria-hidden="true" />}
              title="Nothing to grade"
              description="Submissions from your learners will appear here."
            />
          ) : (
            <Stack gap={4}>
              {queue.map((item) => (
                <GradingCard key={item.submissionId} item={item} />
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
