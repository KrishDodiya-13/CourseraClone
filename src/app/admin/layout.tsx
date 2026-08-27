import type { Metadata } from "next";

import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/authz";
import { Container, Section, Stack } from "@/components/layout/primitives";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Coursera" },
  robots: { index: false, follow: false },
};

/**
 * Console shell.
 *
 * `requireAdmin` here re-reads the session and the role server-side for every
 * page beneath, so the guard is a database-backed check on each request rather
 * than the middleware's edge redirect. The middleware still runs first, but it
 * only ever decides where to *send* someone — it is not what keeps them out.
 *
 * This guard covers rendering. It does **not** cover the Server Actions those
 * pages call: an action is a separate endpoint that never renders this layout,
 * so each one asserts the role again for itself. See `features/admin/actions`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(routes.admin);

  return (
    <Section spacing="md">
      <Container>
        <Stack gap={6}>
          <AdminNav />
          {children}
        </Stack>
      </Container>
    </Section>
  );
}
