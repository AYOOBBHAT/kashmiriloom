import { isPaise } from "@/lib/money";

/**
 * Standard shipping is free, so shippingPaise stays 0.
 * Checkout does not add a separate tax line, so taxPaise stays 0.
 * The zero tax amount is not a finding that a supply is tax-exempt.
 */
export const CHECKOUT_POLICY = {
  shippingPaise: 0,
  taxPaise: 0,
  shippingLabel: "Delivery",
  shippingDetail: "Standard shipping is free. Delivery is expected in about 7 days, and that date is an estimate.",
  taxLabel: "Tax",
  taxDetail:
    "Checkout does not add a separate tax line. The seller states that the business is not registered for GST. This is not a statement that a supply is tax-exempt.",
  paymentDetail:
    "Razorpay test checkout opens after the order is reserved. The order stays unpaid until that payment is captured and checked on the server. Live payments are not accepted.",
} as const;

export function approvedCharges(): { shippingPaise: number; taxPaise: number } {
  const { shippingPaise, taxPaise } = CHECKOUT_POLICY;
  if (!isPaise(shippingPaise) || !isPaise(taxPaise)) {
    throw new Error("Checkout charges are not a whole number of paise.");
  }
  return { shippingPaise, taxPaise };
}
