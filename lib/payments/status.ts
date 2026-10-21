export const PAYMENT_STATUSES = ["pending", "processing", "failed", "paid", "expired"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Unpaid orders keep their catalogue quantity for this long. */
export const UNPAID_HOLD_MS = 30 * 60 * 1000;

export const paymentLabels: Record<PaymentStatus, string> = {
  pending: "Unpaid",
  processing: "Confirming",
  failed: "Failed",
  paid: "Paid",
  expired: "Expired",
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return PAYMENT_STATUSES.some((status) => status === value);
}

export function paymentExpiresAt(from = Date.now()): Date {
  return new Date(from + UNPAID_HOLD_MS);
}
