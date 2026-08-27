import { NextResponse } from "next/server";

import { getProviderById } from "@/features/commerce/providers";
import { fulfilPaymentEvent } from "@/features/commerce/fulfilment";
import type { ProviderId } from "@/features/commerce/provider";

/**
 * Payment webhooks.
 *
 * The only route in the application that can grant paid access, and the only
 * one that deliberately has no session check — a provider does not carry a
 * cookie. Its authentication is the signature over the raw body, which the
 * adapter verifies before this handler looks at a single field.
 *
 * Status codes matter more than usual here. Providers retry on anything that
 * is not 2xx, so:
 *   - a verified event that we handled, or had already handled, returns 200;
 *   - a bad signature returns 400 and is never retried into success;
 *   - an unexpected server fault returns 500 *on purpose*, so the provider
 *     retries and the payment is not silently lost.
 */

const VALID: ProviderId[] = ["STRIPE", "RAZORPAY", "MANUAL"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: slug } = await params;
  const providerId = slug.toUpperCase() as ProviderId;

  if (!VALID.includes(providerId)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const provider = getProviderById(providerId);
  if (!provider || !provider.isConfigured) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 404 });
  }

  // Read the body as text, not JSON. A signature is computed over the exact
  // bytes sent; re-serialising parsed JSON would change them and every
  // signature would fail.
  const rawBody = await request.text();

  const verification = await provider.verifyWebhook({ rawBody, headers: request.headers });

  if (!verification.ok) {
    // Deliberately terse. Telling an attacker which part of their forgery was
    // wrong helps them fix it.
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  try {
    const result = await fulfilPaymentEvent(verification.event, providerId);

    if (!result.ok) {
      // A mismatched amount or an unknown order is not a transient fault, so
      // 200 stops a pointless retry loop. The rejection is recorded against
      // the order for reconciliation.
      return NextResponse.json({ received: true, handled: false, reason: result.reason });
    }

    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (error) {
    console.error("[webhook] fulfilment failed", error);
    // 500 so the provider retries. Losing a paid order because of a transient
    // database error would be far worse than processing it a minute late.
    return NextResponse.json({ error: "Fulfilment failed" }, { status: 500 });
  }
}
