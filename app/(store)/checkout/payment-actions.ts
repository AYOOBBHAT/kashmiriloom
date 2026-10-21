"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { connection } from "next/server";
import { clientAddress } from "@/lib/auth/rate-limit";
import { confirmTestPayment, prepareTestPayment } from "@/lib/payments/service";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const buckets = new Map<string, { attempts: number; resetAt: number }>();

export type PrepareCheckoutState =
  | {
      ok: true;
      alreadyPaid: false;
      reference: string;
      keyId: string;
      orderId: string;
      amount: number;
      currency: "INR";
      description: string;
    }
  | { ok: true; alreadyPaid: true; reference: string }
  | { ok: false; message: string };

export async function prepareCheckout(reference: string): Promise<PrepareCheckoutState> {
  await connection();
  if (!allowed(`prepare:${clientAddress(await headers())}`)) {
    return { ok: false, message: "Please wait a few minutes before trying payment again." };
  }
  const result = await prepareTestPayment(reference);
  if (!result.ok || result.alreadyPaid) {
    return result;
  }
  if (!result.keyId.startsWith("rzp_test_")) {
    return { ok: false, message: "Live payments are turned off. This shop only opens Razorpay test checkout." };
  }
  return {
    ok: true,
    alreadyPaid: false,
    reference: result.reference,
    keyId: result.keyId,
    orderId: result.orderId,
    amount: result.amount,
    currency: result.currency,
    description: result.description,
  };
}

export async function confirmCheckout(
  reference: string,
  paymentId: string,
  signature: string,
): Promise<{ ok: true; reference: string } | { ok: false; message: string }> {
  await connection();
  if (!allowed(`confirm:${clientAddress(await headers())}`)) {
    return { ok: false, message: "Please wait a few minutes before trying payment again." };
  }
  const result = await confirmTestPayment(reference, paymentId, signature);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${result.reference}`);
    revalidatePath(`/admin/orders/${result.reference}`);
  }
  return result;
}

function allowed(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.attempts >= MAX_ATTEMPTS) {
    return false;
  }
  bucket.attempts += 1;
  return true;
}
