import type { Metadata } from "next";

import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/authz";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard · Coursera" },
  robots: { index: false, follow: false },
};

/**
 * Dashboard shell.
 *
 * `requireAuth` here means every page beneath is protected at the data layer,
 * not just by the middleware redirect — a layout guard runs for each of them
 * without every page repeating the call.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(routes.dashboard);

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={6}>
          <DashboardNav />
          {children}
        </Stack>
      </Container>
    </Section>
  );
}
