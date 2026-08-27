import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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
 * Local sandbox provider.
 *
 * This exists because no real payment credentials are configured, and
 * inventing some would be worse than useless. Instead of stubbing the flow
 * out, it simulates a provider properly: it issues a session, redirects to a
 * local page where the outcome is chosen, and posts a **genuinely
 * HMAC-signed** webhook back to the real endpoint.
 *
 * That matters. The signature check, the idempotency key, the retry handling
 * and the fulfilment transaction are all exercised for real — the only
 * pretend part is the card. Swapping in Stripe changes which adapter the
 * registry returns and nothing else.
 *
 * It refuses to run in production, so it can never become an accidental way
 * to grant paid courses.
 */

const SIGNATURE_TOLERANCE_SECONDS = 300;

export interface SandboxWebhookPayload {
  eventId: string;
  paymentId: string;
  sessionId: string;
  orderId: string;
  outcome: "succeeded" | "failed" | "expired";
  amount: number;
  currency: string;
  failureReason?: string;
}

/** The shared secret used to sign sandbox webhooks. */
export function sandboxSecret(): string {
  // Falls back to AUTH_SECRET so the sandbox works out of the box on a fresh
  // checkout without another variable to configure. It is a local-only
  // signing key, never a payment credential.
  return process.env.SANDBOX_WEBHOOK_SECRET ?? process.env.AUTH_SECRET ?? "sandbox";
}

/** Signs a payload exactly as the verifier below expects. */
export function signSandboxPayload(rawBody: string, timestamp: number): string {
  return createHmac("sha256", sandboxSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
}

class SandboxProvider implements PaymentProvider {
  readonly id = "MANUAL" as const;
  readonly displayName = "Sandbox checkout";

  get isConfigured(): boolean {
    // Never available in production. A simulated provider that could run
    // against real data is a way to mint free enrolments.
    return process.env.NODE_ENV !== "production";
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CheckoutSession> {
    const sessionId = `sbx_${randomBytes(12).toString("hex")}`;

    // The sandbox "hosted page" is a local route. It receives only the session
    // id — amounts and items are re-read server-side from the order, exactly
    // as a real provider would not be trusted to report them back.
    return {
      sessionId,
      redirectUrl: `/sandbox/pay/${sessionId}`,
    };
  }

  async verifyWebhook({ rawBody, headers }: VerifyWebhookInput): Promise<VerifyResult> {
    if (!this.isConfigured) return { ok: false, reason: "not_configured" };

    const header = headers.get("x-lumen-signature");
    if (!header) return { ok: false, reason: "bad_signature" };

    const parts = Object.fromEntries(
      header.split(",").map((piece) => piece.split("=", 2) as [string, string]),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return { ok: false, reason: "bad_signature" };

    // Same replay window as the real adapter — the sandbox is not a weaker
    // path, it is the same path with a different signer.
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) {
      return { ok: false, reason: "bad_signature" };
    }

    const expected = signSandboxPayload(rawBody, Number(timestamp));
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad_signature" };
    }

    let parsed: SandboxWebhookPayload;
    try {
      parsed = JSON.parse(rawBody) as SandboxWebhookPayload;
    } catch {
      return { ok: false, reason: "malformed" };
    }

    if (!parsed.eventId || !parsed.orderId) return { ok: false, reason: "malformed" };

    const event: PaymentEvent = {
      eventId: parsed.eventId,
      paymentId: parsed.paymentId,
      sessionId: parsed.sessionId,
      orderId: parsed.orderId,
      kind: parsed.outcome,
      amount: parsed.amount,
      currency: parsed.currency,
      failureReason: parsed.failureReason,
      raw: parsed,
    };

    return { ok: true, event };
  }

  async refund(input: RefundInput) {
    return { ok: true, refundId: `sbx_re_${input.paymentId}` };
  }
}

export { SandboxProvider };
