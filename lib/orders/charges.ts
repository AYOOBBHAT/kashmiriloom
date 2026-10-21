import { isPaise } from "@/lib/money";

/**
 * Shipping and tax are not configured.
 * Checkout charges the catalogue subtotal only.
 * The zero amounts are explicit "not added" values, not calculated rates.
 * Do not replace them with a guessed delivery fee or tax.
 */
export const CHECKOUT_POLICY = {
  shippingPaise: 0,
  taxPaise: 0,
  shippingLabel: "Delivery",
  shippingDetail:
    "No delivery charge is added. A shipping rate has not been set, so checkout does not invent one.",
  taxLabel: "Tax",
  taxDetail: "No separate tax is added. A tax rule has not been set, so checkout does not invent one.",
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
