"use client";

import * as React from "react";
import { useActionState } from "react";
import { CircleAlert, Lock, TicketPercent, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import {
  previewCouponAction,
  startCheckoutAction,
  type ActionResult,
} from "@/features/commerce/actions";

export interface CheckoutItem {
  slug: string;
  title: string;
  instructorName: string;
  categoryName: string;
  priceAmount: number;
}

/**
 * Checkout summary and submit.
 *
 * The discount shown here is a *preview*, computed by the server and displayed
 * for the shopper's benefit. It is not what the order is created with — the
 * coupon is re-evaluated at submit, so a code that expires between looking and
 * paying does not still apply, and a tampered figure changes nothing.
 */
function CheckoutForm({
  items,
  currency,
  providerName,
}: {
  items: CheckoutItem[];
  currency: string;
  providerName: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    startCheckoutAction,
    null,
  );

  const [code, setCode] = React.useState("");
  const [applied, setApplied] = React.useState<{ code: string; discountAmount: number } | null>(
    null,
  );
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.priceAmount, 0);
  const discount = applied?.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  async function applyCoupon() {
    setChecking(true);
    setCouponError(null);

    const result = await previewCouponAction({
      code,
      courseSlugs: items.map((item) => item.slug),
    });

    setChecking(false);

    if (!result.ok || !result.data) {
      setCouponError(result.message ?? "That code cannot be used.");
      setApplied(null);
      return;
    }

    setApplied(result.data);
    toast.success(`Code ${result.data.code} applied`, {
      description: `You save ${formatPrice(result.data.discountAmount, currency)}.`,
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {items.map((item) => (
        <input key={item.slug} type="hidden" name="courseSlug" value={item.slug} />
      ))}
      {applied ? <input type="hidden" name="couponCode" value={applied.code} /> : null}

      {state?.ok === false && state.message ? (
        <p
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}

      {/* --- coupon ---------------------------------------------------- */}
      <div className="flex flex-col gap-2">
        <label htmlFor="coupon" className="text-sm font-medium">
          Coupon code
        </label>

        {applied ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success-subtle p-3">
            <TicketPercent className="size-4 shrink-0 text-success" aria-hidden="true" />
            <span className="flex-1 font-mono text-sm text-success">{applied.code}</span>
            <span className="text-sm font-medium text-success" data-numeric>
              −{formatPrice(applied.discountAmount, currency)}
            </span>
            <button
              type="button"
              onClick={() => {
                setApplied(null);
                setCode("");
              }}
              aria-label="Remove coupon"
              className="rounded-md p-1 text-success hover:bg-success/10"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              id="coupon"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="LAUNCH25"
              className="font-mono"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void applyCoupon()}
              isLoading={checking}
              loadingText="Checking"
              disabled={!code.trim()}
            >
              Apply
            </Button>
          </div>
        )}

        {couponError ? (
          <p className="text-sm text-danger" role="alert">
            {couponError}
          </p>
        ) : null}
      </div>

      <Separator />

      {/* --- totals ----------------------------------------------------- */}
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd data-numeric>{formatPrice(subtotal, currency)}</dd>
        </div>

        {discount > 0 ? (
          <div className="flex justify-between text-success">
            <dt>Discount</dt>
            <dd data-numeric>−{formatPrice(discount, currency)}</dd>
          </div>
        ) : null}

        <Separator className="my-1" />

        <div className="flex items-baseline justify-between">
          <dt className="font-medium">Total</dt>
          <dd className="font-display text-2xl font-semibold" data-numeric>
            {formatPrice(total, currency)}
          </dd>
        </div>
      </dl>

      <Button type="submit" size="lg" fullWidth isLoading={pending} loadingText="Opening payment">
        <Lock aria-hidden="true" />
        Pay {formatPrice(total, currency)}
      </Button>

      <p className={cn("text-center text-sm text-muted-foreground")}>
        {providerName ? (
          <>
            You will be taken to {providerName} to pay. Your course is added once the payment is
            confirmed by the provider — not when you return here.
          </>
        ) : (
          "Payments are not configured on this deployment."
        )}
      </p>
    </form>
  );
}

export { CheckoutForm };
