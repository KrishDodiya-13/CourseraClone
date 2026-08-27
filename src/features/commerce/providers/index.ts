import "server-only";

import type { PaymentProvider, ProviderId } from "@/features/commerce/provider";
import { StripeProvider } from "@/features/commerce/providers/stripe";
import { SandboxProvider } from "@/features/commerce/providers/sandbox";

/**
 * Provider registry.
 *
 * The rest of the application asks for "the active provider" and never names
 * one. Adding Razorpay is a new file plus a line here.
 *
 * Selection is by configuration, not by preference: a provider whose
 * credentials are absent reports `isConfigured: false` and is skipped. That is
 * what keeps an unconfigured deployment from failing at the moment someone
 * tries to pay, rather than at startup.
 */
const stripe = new StripeProvider();
const sandbox = new SandboxProvider();

const ALL: PaymentProvider[] = [stripe, sandbox];

/** Providers in preference order. Real money before simulated. */
export function getActiveProvider(): PaymentProvider | null {
  return ALL.find((provider) => provider.isConfigured) ?? null;
}

export function getProviderById(id: ProviderId): PaymentProvider | null {
  return ALL.find((provider) => provider.id === id) ?? null;
}

/** Whether checkout can be offered at all. */
export function isCheckoutAvailable(): boolean {
  return getActiveProvider() !== null;
}

export { stripe, sandbox };
