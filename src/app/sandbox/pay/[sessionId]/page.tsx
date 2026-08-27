import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";

import { db } from "@/server/db";
import { routes } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { SandboxForm } from "./sandbox-form";

export const metadata: Metadata = {
  title: "Sandbox checkout",
  robots: { index: false, follow: false },
};

// The order is written by a webhook mid-request; nothing here may be cached.
export const dynamic = "force-dynamic";

/**
 * The sandbox provider's hosted page.
 *
 * Stands where Stripe Checkout would stand. It exists so the whole payment
 * path — signature, idempotency, amount check, fulfilment transaction — can be
 * exercised without inventing credentials for a real provider.
 *
 * Refuses to render in production, matching the provider adapter, so it can
 * never become a way to mint free enrolments.
 */
export default async function SandboxPayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { sessionId } = await params;
  const user = await requireAuth(`/sandbox/pay/${sessionId}`);

  // Scoped to the signed-in owner: the session id is a lookup key, not a
  // capability, exactly as an order number is not one.
  const order = await db.order.findFirst({
    where: { providerSessionId: sessionId, userId: user.id },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      currency: true,
      items: { select: { courseId: true, titleSnapshot: true, unitAmount: true } },
    },
  });

  if (!order) notFound();

  return (
    <Section spacing="md">
      <Container size="sm">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Simulated provider"
            title="Sandbox checkout"
            description="No real payment provider is configured, so this local simulator stands in for one. It signs and posts a real webhook — only the card is pretend."
          />

          <Card className="flex items-start gap-3 border-warning/40 p-4">
            <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Development only. This page does not exist in production, and the sandbox provider
              refuses to load there.
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
                Order
              </span>
              <code className="font-mono text-sm">{order.orderNumber}</code>
            </div>

            {order.items.map((item) => (
              <div key={item.courseId} className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{item.titleSnapshot}</span>
                <span className="shrink-0 text-sm text-muted-foreground" data-numeric>
                  {formatPrice(item.unitAmount, order.currency)}
                </span>
              </div>
            ))}

            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">Amount due</span>
              <span className="font-display text-xl font-semibold" data-numeric>
                {formatPrice(order.totalAmount, order.currency)}
              </span>
            </div>
          </Card>

          <Card variant="elevated" className="p-5">
            <SandboxForm sessionId={sessionId} />
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Whatever you choose here, access is granted only by the webhook —{" "}
            <Link href={routes.orders} className="underline hover:text-foreground">
              check your orders
            </Link>{" "}
            to see what actually happened.
          </p>
        </Stack>
      </Container>
    </Section>
  );
}
