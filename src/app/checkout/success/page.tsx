import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock3 } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { getOrderByNumber } from "@/features/commerce/queries";

export const metadata: Metadata = {
  title: "Payment received",
  robots: { index: false, follow: false },
};

/**
 * The page the provider sends the browser back to.
 *
 * It grants nothing. Reaching this URL — by paying, or by typing it — has no
 * effect on any order, because access is created only by the webhook. The page
 * reads the order's *current* status and reports it honestly, which is why a
 * payment still in flight shows "confirming" rather than a false success.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;
  const user = await requireAuth(routes.checkoutSuccess);

  const order = orderNumber ? await getOrderByNumber(user.id, orderNumber) : null;

  if (!order) {
    return (
      <Section spacing="lg">
        <Container size="sm">
          <EmptyState
            title="We could not find that order"
            description="If you have just paid, it may take a moment to appear. Your order history is the place to check."
            size="lg"
            actions={
              <Button asChild>
                <Link href={routes.orders}>View my orders</Link>
              </Button>
            }
          />
        </Container>
      </Section>
    );
  }

  const paid = order.status === "PAID";

  return (
    <Section spacing="md">
      <Container size="sm">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Checkout"
            title={paid ? "Payment received" : "Confirming your payment"}
            description={
              paid
                ? "Your courses are ready."
                : "Your payment is being confirmed by the provider. This page updates once it is."
            }
          />

          <Card className={paid ? "border-success/40 p-5" : "border-warning/40 p-5"}>
            <div className="flex items-start gap-3">
              {paid ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <Clock3 className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-sm font-semibold">
                  {paid ? "Order complete" : "Waiting on the payment provider"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {paid
                    ? "Access was granted when the provider confirmed the payment."
                    : "We never grant access on returning from the provider — only when the provider confirms it directly. Refresh in a moment."}
                </p>
              </div>
              <Badge variant={paid ? "success" : "warning"}>{order.status.toLowerCase()}</Badge>
            </div>
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
                <span className="text-sm">{item.title}</span>
                <span className="shrink-0 text-sm text-muted-foreground" data-numeric>
                  {formatPrice(item.unitAmount, order.currency)}
                </span>
              </div>
            ))}

            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-medium">Total paid</span>
              <span className="font-display text-xl font-semibold" data-numeric>
                {formatPrice(order.totalAmount, order.currency)}
              </span>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {paid ? (
              <Button asChild>
                <Link href={routes.dashboardCourses}>Start learning</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={routes.order(order.orderNumber)}>View receipt</Link>
            </Button>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
