"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/server/db";
import { routes } from "@/lib/routes";
import { clientEnv } from "@/lib/env";
import { assertAuth, AuthorizationError } from "@/server/authz";
import {
  signSandboxPayload,
  type SandboxWebhookPayload,
} from "@/features/commerce/providers/sandbox";

/**
 * The sandbox provider's "bank".
 *
 * This action stands in for the provider's servers, so it does what they would
 * do and nothing more: it signs a payload and POSTs it to the public webhook
 * endpoint over real HTTP. It does not touch enrolments, orders or payments
 * itself — if the webhook path were broken, nothing here would paper over it.
 *
 * The amount it reports is read from the order, never from the form, so the
 * simulator cannot be used to underpay.
 */

const schema = z.object({
  sessionId: z.string().min(1).max(128),
  outcome: z.enum(["succeeded", "failed", "expired"]),
  /** Deliberately allows sending the same event twice, to prove idempotency. */
  eventId: z.string().max(128).optional(),
  /** Deliberately allows a wrong amount, to prove the mismatch check. */
  amountOverride: z.coerce.number().int().optional(),
});

export interface SandboxResult {
  ok: boolean;
  message: string;
  eventId?: string;
}

export async function simulatePaymentAction(
  _previous: SandboxResult | null,
  formData: FormData,
): Promise<SandboxResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, message: "The sandbox is disabled in production." };
  }

  const parsed = schema.safeParse({
    sessionId: formData.get("sessionId"),
    outcome: formData.get("outcome"),
    eventId: (formData.get("eventId") as string | null) || undefined,
    amountOverride: (formData.get("amountOverride") as string | null) || undefined,
  });

  if (!parsed.success) return { ok: false, message: "That request is not valid." };

  try {
    await assertAuth();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: "Sign in first." };
    throw error;
  }

  const order = await db.order.findUnique({
    where: { providerSessionId: parsed.data.sessionId },
    select: { id: true, orderNumber: true, totalAmount: true, currency: true },
  });

  if (!order) return { ok: false, message: "No order is attached to that session." };

  const eventId = parsed.data.eventId?.trim() || `sbx_evt_${randomUUID()}`;

  const payload: SandboxWebhookPayload = {
    eventId,
    paymentId: `sbx_pi_${parsed.data.sessionId}`,
    sessionId: parsed.data.sessionId,
    orderId: order.id,
    outcome: parsed.data.outcome,
    amount: parsed.data.amountOverride ?? order.totalAmount,
    currency: order.currency,
    ...(parsed.data.outcome === "failed" ? { failureReason: "card_declined" } : {}),
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signSandboxPayload(rawBody, timestamp);

  let response: Response;
  try {
    response = await fetch(`${clientEnv.NEXT_PUBLIC_APP_URL}/api/webhooks/manual`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lumen-signature": `t=${timestamp},v1=${signature}`,
      },
      body: rawBody,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[sandbox] webhook delivery failed", error);
    return { ok: false, message: "The webhook could not be delivered." };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `The webhook endpoint rejected the event (${response.status}).`,
      eventId,
    };
  }

  const body = (await response.json()) as { outcome?: string; handled?: boolean; reason?: string };

  // A rejected-but-acknowledged event (amount mismatch, unknown order) returns
  // 200 to stop retries, so it is reported here rather than treated as success.
  if (body.handled === false) {
    return { ok: false, message: `Rejected by fulfilment: ${body.reason ?? "unknown"}`, eventId };
  }

  redirect(
    parsed.data.outcome === "succeeded"
      ? `${routes.checkoutSuccess}?order=${order.orderNumber}`
      : `${routes.order(order.orderNumber)}`,
  );
}
