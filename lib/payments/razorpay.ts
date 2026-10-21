import "server-only";

import Razorpay from "razorpay";
import type { PaymentGateway, RemotePayment } from "@/lib/payments/gateway";
import { readTestCheckoutConfig } from "@/lib/payments/config";

const REQUEST_MS = 10_000;

export function livePaymentGateway(): PaymentGateway | null {
  const config = readTestCheckoutConfig();
  if (!config.ok) {
    return null;
  }
  const client = new Razorpay({ key_id: config.config.keyId, key_secret: config.config.keySecret });
  return {
    async createOrder(input) {
      const created = await withTimeout(
        client.orders.create({
          amount: input.amount,
          currency: input.currency,
          receipt: input.receipt,
          notes: { receipt: input.receipt },
          payment: {
            capture: "automatic",
            capture_options: {
              automatic_expiry_period: 12,
              manual_expiry_period: 7200,
              refund_speed: "normal",
            },
          },
        }),
      );
      const amount = wholeAmount(created.amount);
      if (!created.id || amount === null || created.currency !== "INR") {
        throw new Error("Razorpay order did not match the reserved amount.");
      }
      return { id: created.id, amount, currency: "INR" };
    },
    async fetchPayment(paymentId) {
      const payment = await withTimeout(client.payments.fetch(paymentId));
      return toRemote(payment);
    },
    async listOrderPayments(orderId) {
      const page = await withTimeout(client.orders.fetchPayments(orderId));
      return page.items.flatMap((item) => {
        const payment = toRemote(item);
        return payment ? [payment] : [];
      });
    },
    async capturePayment(paymentId, amount) {
      const payment = await withTimeout(client.payments.capture(paymentId, amount, "INR"));
      const remote = toRemote(payment);
      if (!remote) {
        throw new Error("Razorpay capture did not return a payment.");
      }
      return remote;
    },
  };
}

function toRemote(payment: {
  id?: string;
  order_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
}): RemotePayment | null {
  if (!payment.id || !payment.order_id || !payment.currency || !payment.status) {
    return null;
  }
  const amount = wholeAmount(payment.amount);
  if (amount === null) {
    return null;
  }
  return {
    id: payment.id,
    orderId: payment.order_id,
    amount,
    currency: payment.currency,
    status: payment.status,
  };
}

function wholeAmount(value: number | string | undefined): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(amount)) {
    return null;
  }
  return amount;
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Razorpay request timed out.")), REQUEST_MS);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("Razorpay request failed."));
      },
    );
  });
}
