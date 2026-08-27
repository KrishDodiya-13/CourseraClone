import type { Metadata } from "next";

import { Container, Section, Stack } from "@/components/layout/primitives";
import { PageHeader } from "@/components/layout/primitives";
import { Gallery } from "@/app/design/gallery";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Every component in the Coursera design system, rendered together so regressions are visible at a glance.",
};

export default function DesignPage() {
  return (
    <Section spacing="md">
      <Container>
        <Stack gap={10}>
          <PageHeader
            eyebrow="Phase 1"
            title="Design system"
            description="Every primitive in one place. Switch the theme from the header — anything that only works in one of them shows up here immediately."
          />
          <Gallery />
        </Stack>
      </Container>
    </Section>
  );
}
