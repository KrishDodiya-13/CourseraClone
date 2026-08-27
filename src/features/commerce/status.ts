import type { OrderSummary } from "@/features/commerce/queries";

/**
 * How each order state is presented.
 *
 * Kept in one place so the history list, the receipt and the success page
 * cannot drift into describing the same status differently — a receipt that
 * disagrees with the list it came from is a support ticket.
 */
export const ORDER_STATUS: Record<
  OrderSummary["status"],
  { label: string; tone: "neutral" | "success" | "warning" | "danger"; description: string }
> = {
  PENDING: {
    label: "Awaiting payment",
    tone: "warning",
    description: "Started, but not confirmed by the payment provider yet.",
  },
  PAID: {
    label: "Paid",
    tone: "success",
    description: "Confirmed by the payment provider. Access granted.",
  },
  FAILED: {
    label: "Failed",
    tone: "danger",
    description: "The payment did not go through. Nothing was charged.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "neutral",
    description: "Abandoned or expired before payment. Nothing was charged.",
  },
  REFUNDED: {
    label: "Refunded",
    tone: "neutral",
    description: "The payment was returned and access was withdrawn.",
  },
  PARTIALLY_REFUNDED: {
    label: "Partly refunded",
    tone: "warning",
    description: "Part of this order was returned.",
  },
};
