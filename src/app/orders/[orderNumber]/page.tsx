import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatDateTime, formatPrice } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { getOrderByNumber } from "@/features/commerce/queries";
import { ORDER_STATUS } from "@/features/commerce/status";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

function formatMoment(iso: string): string {
  return formatDateTime(iso);
}

/**
 * A single order's receipt.
 *
 * Scoped to its owner by the query, not by obscurity — knowing an order number
 * gets you nothing. Amounts come from the order's own snapshot, so a course
 * repriced since does not rewrite history.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await requireAuth(routes.order(orderNumber));

  const order = await getOrderByNumber(user.id, orderNumber);
  if (!order) notFound();

  const status = ORDER_STATUS[order.status];

  return (
    <Section spacing="md">
      <Container size="sm">
        <Stack gap={6}>
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link href={routes.orders}>
              <ArrowLeft aria-hidden="true" />
              All orders
            </Link>
          </Button>

          <PageHeader
            eyebrow="Receipt"
            title={order.orderNumber}
            description={formatMoment(order.placedAt)}
          />

          <Card className="flex items-start justify-between gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">{status.label}</p>
              <p className="text-sm text-muted-foreground">{status.description}</p>
            </div>
            <Badge variant={status.tone}>{status.label}</Badge>
          </Card>

          {/* --- what was bought ------------------------------------------ */}
          <Card className="flex flex-col gap-3 p-5">
            {order.items.map((item) => (
              <div key={item.courseId} className="flex items-baseline justify-between gap-3">
                {item.courseSlug ? (
                  <Link
                    href={routes.course(item.courseSlug)}
                    className="text-sm hover:text-primary"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <span className="text-sm">{item.title}</span>
                )}
                <span className="shrink-0 text-sm text-muted-foreground" data-numeric>
                  {formatPrice(item.unitAmount, order.currency)}
                </span>
              </div>
            ))}

            <Separator />

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd data-numeric>{formatPrice(order.subtotalAmount, order.currency)}</dd>
              </div>

              {order.discountAmount > 0 ? (
                <div className="flex justify-between text-success">
                  <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                  <dd data-numeric>−{formatPrice(order.discountAmount, order.currency)}</dd>
                </div>
              ) : null}

              <Separator className="my-1" />

              <div className="flex items-baseline justify-between">
                <dt className="font-medium">Total</dt>
                <dd className="font-display text-xl font-semibold" data-numeric>
                  {formatPrice(order.totalAmount, order.currency)}
                </dd>
              </div>
            </dl>
          </Card>

          {/* --- what the provider did ------------------------------------ */}
          {order.payments.length > 0 ? (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-sm font-semibold">Payment attempts</h2>
              <p className="text-sm text-muted-foreground">
                Recorded from the payment provider&rsquo;s own confirmations, not from this browser.
              </p>

              {order.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {payment.status.toLowerCase()} · {payment.provider.toLowerCase()}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {formatMoment(payment.createdAt)}
                      {payment.failureReason ? ` · ${payment.failureReason}` : ""}
                    </span>
                  </div>
                  <span className="text-muted-foreground" data-numeric>
                    {formatPrice(payment.amount, order.currency)}
                  </span>
                </div>
              ))}
            </Card>
          ) : null}

          {order.status === "PAID" ? (
            <Button asChild className="w-fit">
              <Link href={routes.dashboardCourses}>Go to my courses</Link>
            </Button>
          ) : null}
        </Stack>
      </Container>
    </Section>
  );
}
