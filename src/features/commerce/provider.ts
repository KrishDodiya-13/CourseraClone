import "server-only";

/**
 * The payment provider seam.
 *
 * Everything the application knows about taking money is this interface. No
 * Stripe type, no Razorpay type and no provider SDK appears anywhere outside
 * `providers/`, so replacing the provider is a new file implementing four
 * methods — not a rewrite of commerce.
 *
 * The interface is shaped around what the domain needs, not around what any
 * one provider's API looks like. That is the difference between an
 * abstraction and a thin wrapper: a wrapper leaks the provider's vocabulary
 * and has to be rebuilt when the provider is swapped.
 */

export type ProviderId = "STRIPE" | "RAZORPAY" | "MANUAL";

export interface CheckoutLineItem {
  courseId: string;
  title: string;
  /** Integer minor units. */
  unitAmount: number;
}

export interface CreateCheckoutInput {
  orderId: string;
  orderNumber: string;
  /** Integer minor units, after any discount. */
  totalAmount: number;
  currency: string;
  items: CheckoutLineItem[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** The provider's id for this session. Stored on the order. */
  sessionId: string;
  /** Where to send the browser. */
  redirectUrl: string;
}

/**
 * The normalised shape of a provider webhook, after signature verification.
 *
 * Providers disagree about names and nesting; every adapter maps its own
 * payload onto this so fulfilment logic never branches on provider.
 */
export interface PaymentEvent {
  /**
   * The provider's id for this *event*, not the payment.
   *
   * This is the idempotency key. A provider retries a webhook until it gets a
   * 2xx, so the same event will arrive more than once and must be recognised.
   */
  eventId: string;
  /** The provider's id for the payment or intent. */
  paymentId: string;
  /** The checkout session, used to find the order. */
  sessionId: string | null;
  /** Our own order id, when the provider carried it as metadata. */
  orderId: string | null;
  kind: "succeeded" | "failed" | "expired" | "refunded" | "ignored";
  amount: number;
  currency: string;
  failureReason?: string;
  /** Retained verbatim for reconciliation and disputes. */
  raw: unknown;
}

export interface VerifyWebhookInput {
  /** The exact bytes as received. Signature checks are over raw text. */
  rawBody: string;
  headers: Headers;
}

export type VerifyResult =
  | { ok: true; event: PaymentEvent }
  | { ok: false; reason: "bad_signature" | "malformed" | "not_configured" };

export interface RefundInput {
  paymentId: string;
  /** Minor units. Omit to refund in full. */
  amount?: number;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  /** False when the required environment variables are absent. */
  readonly isConfigured: boolean;
  /** Shown on the checkout button. */
  readonly displayName: string;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;

  /**
   * Verifies a webhook's signature and normalises it.
   *
   * Must never trust the body without checking the signature — a webhook
   * endpoint is public, and an unverified one lets anyone grant themselves a
   * course by posting a "payment succeeded" message.
   */
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyResult>;

  refund(input: RefundInput): Promise<{ ok: boolean; refundId?: string; error?: string }>;
}
