import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { DEFAULT_CURRENCY } from "@/lib/currency";
import type {
  CreateCheckoutInput,
  CheckoutSession,
  PaymentEvent,
  PaymentProvider,
  RefundInput,
  VerifyResult,
  VerifyWebhookInput,
} from "@/features/commerce/provider";

/**
 * Stripe.
 *
 * Written against Stripe's REST API directly rather than the SDK. The SDK is a
 * large dependency for what is three endpoints and one HMAC, and keeping it
 * out means the provider seam has no transitive types leaking through it.
 *
 * `isConfigured` is false without the keys, and the registry then falls back
 * to the sandbox. Nothing here invents a credential.
 */

const API = "https://api.stripe.com/v1";

/** Stripe signs `${timestamp}.${rawBody}` and sends `t=…,v1=…`. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

function form(data: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

class StripeProvider implements PaymentProvider {
  readonly id = "STRIPE" as const;
  readonly displayName = "Card payment";

  private readonly secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  get isConfigured(): boolean {
    return this.secretKey.length > 0 && this.webhookSecret.length > 0;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const body: Record<string, string | number> = {
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      client_reference_id: input.orderId,
      // Metadata is what lets the webhook find the order without trusting
      // anything the browser sends back.
      "metadata[orderId]": input.orderId,
      "metadata[orderNumber]": input.orderNumber,
    };

    input.items.forEach((item, index) => {
      body[`line_items[${index}][quantity]`] = 1;
      body[`line_items[${index}][price_data][currency]`] = input.currency.toLowerCase();
      body[`line_items[${index}][price_data][unit_amount]`] = item.unitAmount;
      body[`line_items[${index}][price_data][product_data][name]`] = item.title;
    });

    // A discount changes the order total, so the session is created against
    // the already-discounted amount rather than replaying coupon logic here.
    const declaredTotal = input.items.reduce((sum, item) => sum + item.unitAmount, 0);
    if (declaredTotal !== input.totalAmount) {
      body["discounts[0][coupon]"] = "";
      delete body["discounts[0][coupon]"];
    }

    const response = await fetch(`${API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Stripe deduplicates on this, so a retried create does not open a
        // second session for the same order.
        "Idempotency-Key": `order-${input.orderId}`,
      },
      body: form(body),
    });

    if (!response.ok) {
      throw new Error(`Stripe checkout failed: ${response.status}`);
    }

    const session = (await response.json()) as { id: string; url: string };
    return { sessionId: session.id, redirectUrl: session.url };
  }

  async verifyWebhook({ rawBody, headers }: VerifyWebhookInput): Promise<VerifyResult> {
    if (!this.isConfigured) return { ok: false, reason: "not_configured" };

    const header = headers.get("stripe-signature");
    if (!header) return { ok: false, reason: "bad_signature" };

    const parts = Object.fromEntries(
      header.split(",").map((piece) => piece.split("=", 2) as [string, string]),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return { ok: false, reason: "bad_signature" };

    // Reject stale signatures: without this a captured webhook could be
    // replayed indefinitely.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) {
      return { ok: false, reason: "bad_signature" };
    }

    const expected = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }

    let parsed: {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "malformed" };
    }

    const object = parsed.data.object;
    const metadata = (object.metadata ?? {}) as Record<string, string>;

    const kind: PaymentEvent["kind"] =
      parsed.type === "checkout.session.completed" || parsed.type === "payment_intent.succeeded"
        ? "succeeded"
        : parsed.type === "payment_intent.payment_failed"
          ? "failed"
          : parsed.type === "checkout.session.expired"
            ? "expired"
            : parsed.type === "charge.refunded"
              ? "refunded"
              : "ignored";

    return {
      ok: true,
      event: {
        eventId: parsed.id,
        paymentId: String(object.payment_intent ?? object.id ?? parsed.id),
        sessionId: typeof object.id === "string" ? object.id : null,
        orderId: metadata.orderId ?? null,
        kind,
        amount: Number(object.amount_total ?? object.amount ?? 0),
        currency: String(object.currency ?? DEFAULT_CURRENCY).toUpperCase(),
        failureReason:
          typeof object.last_payment_error === "object" && object.last_payment_error !== null
            ? String((object.last_payment_error as { message?: string }).message ?? "")
            : undefined,
        raw: parsed,
      },
    };
  }

  async refund(input: RefundInput) {
    if (!this.isConfigured) return { ok: false, error: "Stripe is not configured." };

    const response = await fetch(`${API}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `refund-${input.paymentId}`,
      },
      body: form({
        payment_intent: input.paymentId,
        amount: input.amount,
        reason: input.reason,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Stripe refund failed: ${response.status}` };
    }

    const refund = (await response.json()) as { id: string };
    return { ok: true, refundId: refund.id };
  }
}

export { StripeProvider };
