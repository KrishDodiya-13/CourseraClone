import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatDate, formatPrice } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { getOrders } from "@/features/commerce/queries";
import { ORDER_STATUS } from "@/features/commerce/status";

export const metadata: Metadata = {
  title: "Order history",
  robots: { index: false, follow: false },
};

/**
 * Transaction history.
 *
 * Every attempt is listed, not just the successful ones. A failed or abandoned
 * checkout showing up here is the point: someone who thinks they paid twice can
 * see for themselves what actually happened.
 */
export default async function OrdersPage() {
  const user = await requireAuth(routes.orders);
  const orders = await getOrders(user.id);

  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Account"
            title="Order history"
            description="Every purchase attempt on your account, successful or not."
          />

          {orders.length === 0 ? (
            <EmptyState
              icon={<Receipt aria-hidden="true" />}
              title="No orders yet"
              description="Purchases you make will appear here with a receipt you can revisit any time."
              actions={
                <Button asChild>
                  <Link href={routes.courses}>Browse courses</Link>
                </Button>
              }
            />
          ) : (
            <Stack gap={3}>
              {orders.map((order) => {
                const status = ORDER_STATUS[order.status];

                return (
                  <Card key={order.id} className="p-0">
                    <Link
                      href={routes.order(order.orderNumber)}
                      className="flex flex-col gap-3 rounded-[inherit] p-4 hover:bg-muted/40 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="font-mono text-sm font-medium">{order.orderNumber}</code>
                          <Badge variant={status.tone} size="sm">
                            {status.label}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {order.items.map((item) => item.title).join(" · ")}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          {formatDate(order.placedAt)}
                        </p>
                      </div>

                      <span className="shrink-0 font-display text-lg font-semibold" data-numeric>
                        {formatPrice(order.totalAmount, order.currency)}
                      </span>
                    </Link>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
