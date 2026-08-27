import type { Metadata } from "next";
import Link from "next/link";
import { CircleX } from "lucide-react";

import { routes } from "@/lib/routes";
import { requireAuth } from "@/server/authz";
import { Button } from "@/components/ui/button";
import { Container, Section } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false, follow: false },
};

/**
 * Where the provider sends someone who backed out.
 *
 * The order stays PENDING and expires on its own. Nothing was charged and
 * nothing needs undoing — abandoning a checkout is the normal case, not an
 * error, so the copy does not treat it as a failure.
 */
export default async function CheckoutCancelledPage() {
  await requireAuth(routes.checkoutCancelled);

  return (
    <Section spacing="lg">
      <Container size="sm">
        <EmptyState
          icon={<CircleX aria-hidden="true" />}
          title="Payment cancelled"
          description="Nothing was charged. Your basket is still there if you want to pick it up again."
          size="lg"
          actions={
            <>
              <Button asChild>
                <Link href={routes.courses}>Keep browsing</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={routes.orders}>My orders</Link>
              </Button>
            </>
          }
        />
      </Container>
    </Section>
  );
}
