import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, ShieldCheck, TriangleAlert } from "lucide-react";

import { routes } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { requireAuth } from "@/server/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container, PageHeader, Section, Stack } from "@/components/layout/primitives";
import { EmptyState } from "@/components/states/empty-state";
import { CourseThumbnail } from "@/components/catalog/course-thumbnail";
import { CheckoutForm } from "@/app/checkout/checkout-form";
import { buildBasket } from "@/features/commerce/orders";
import { getActiveProvider } from "@/features/commerce/providers";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * Checkout.
 *
 * The basket comes from `?course=` slugs in the URL, resolved server-side into
 * real prices. Anything already owned, unpublished or free is filtered out
 * before a total is shown — a free course is enrolled directly and should
 * never reach a payment provider.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const { course } = await searchParams;
  const user = await requireAuth(routes.checkout);

  const slugs = (Array.isArray(course) ? course : course ? [course] : []).filter(Boolean);
  const basket = await buildBasket(user.id, slugs);
  const provider = getActiveProvider();

  const owned = basket.problems.filter((problem) => problem.reason === "already_owned");
  const free = basket.problems.filter((problem) => problem.reason === "free");

  if (basket.items.length === 0) {
    return (
      <Section spacing="lg">
        <Container size="sm">
          <EmptyState
            icon={<CreditCard aria-hidden="true" />}
            title={
              owned.length > 0
                ? "You already own this"
                : free.length > 0
                  ? "This course is free"
                  : "Nothing to check out"
            }
            description={
              owned.length > 0
                ? "There is nothing left to pay for here."
                : free.length > 0
                  ? "Free courses are enrolled directly — no payment needed."
                  : "Pick a course first and we will bring you back here."
            }
            size="lg"
            actions={
              <>
                <Button asChild>
                  <Link href={owned.length > 0 ? routes.dashboardCourses : routes.courses}>
                    {owned.length > 0 ? "Go to my courses" : "Browse courses"}
                  </Link>
                </Button>
              </>
            }
          />
        </Container>
      </Section>
    );
  }

  return (
    <Section spacing="md">
      <Container size="md">
        <Stack gap={6}>
          <PageHeader
            eyebrow="Checkout"
            title="Complete your purchase"
            description={`${basket.items.length} ${
              basket.items.length === 1 ? "course" : "courses"
            } · lifetime access`}
          />

          {!provider ? (
            <Card className="flex items-start gap-3 border-warning/40 p-4">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">No payment provider is configured</p>
                <p className="text-sm text-muted-foreground">
                  Set <code className="font-mono">STRIPE_SECRET_KEY</code> and{" "}
                  <code className="font-mono">STRIPE_WEBHOOK_SECRET</code>, or run in development to
                  use the sandbox provider.
                </p>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            {/* --- basket ------------------------------------------------ */}
            <Stack gap={4}>
              {basket.items.map((item) => (
                <Card key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row">
                  <Link
                    href={routes.course(item.slug)}
                    className="w-full shrink-0 overflow-hidden rounded-lg sm:w-40"
                  >
                    <CourseThumbnail title={item.title} src={item.thumbnailUrl} />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Badge variant="primary" size="sm" className="w-fit">
                      {item.categoryName}
                    </Badge>
                    <Link
                      href={routes.course(item.slug)}
                      className="text-base font-semibold hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{item.instructorName}</p>
                  </div>

                  <span className="shrink-0 font-display text-lg font-semibold" data-numeric>
                    {formatPrice(item.priceAmount, item.currency)}
                  </span>
                </Card>
              ))}

              {owned.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {owned.length} course{owned.length === 1 ? "" : "s"} removed from this basket
                  because you already own {owned.length === 1 ? "it" : "them"}.
                </p>
              ) : null}
            </Stack>

            {/* --- summary ----------------------------------------------- */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <Card variant="elevated" className="p-5">
                <CheckoutForm
                  items={basket.items.map((item) => ({
                    slug: item.slug,
                    title: item.title,
                    instructorName: item.instructorName,
                    categoryName: item.categoryName,
                    priceAmount: item.priceAmount,
                  }))}
                  currency={basket.currency}
                  providerName={provider?.displayName ?? null}
                />
              </Card>

              <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                Card details are handled entirely by the payment provider. Coursera never sees or
                stores them.
              </p>
            </div>
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
