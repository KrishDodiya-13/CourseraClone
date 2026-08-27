import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";

import { routes } from "@/lib/routes";
import { getSessionUser } from "@/server/authz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container, Section } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

/**
 * Shown when a signed-in user reaches something their role or relationship
 * does not cover.
 *
 * It says what is missing without listing what exists — naming the required
 * role is fine; enumerating the routes behind it is not.
 */
export default async function UnauthorizedPage() {
  const user = await getSessionUser();

  return (
    <Section spacing="lg">
      <Container size="sm">
        <EmptyState
          icon={<ShieldX aria-hidden="true" />}
          title="You do not have access to this"
          description={
            user
              ? "Your account does not have permission for this page. If that looks wrong, contact whoever administers your organisation."
              : "You need to be signed in to view this page."
          }
          size="lg"
          actions={
            <>
              {user ? (
                <Button asChild>
                  <Link href={routes.dashboard}>Go to dashboard</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href={routes.login}>Log in</Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href={routes.home}>Back to home</Link>
              </Button>
            </>
          }
        >
          {user ? (
            <Badge variant="neutral" size="sm">
              Signed in as {user.email} · {user.role.toLowerCase()}
            </Badge>
          ) : null}
        </EmptyState>
      </Container>
    </Section>
  );
}
