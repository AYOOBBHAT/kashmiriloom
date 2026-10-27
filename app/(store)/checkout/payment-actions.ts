"use server";

import { revalidatePath } from "next/cache";
import { expirePublicCatalogue } from "@/lib/catalogue/public-cache";
import { headers } from "next/headers";
import { connection } from "next/server";
import { clientAddress } from "@/lib/auth/rate-limit";
import { paymentAttemptStatus } from "@/lib/payments/attempt-limit";
import { confirmTestPayment, prepareTestPayment } from "@/lib/payments/service";

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
  const limited = await paymentAttemptStatus("prepare", clientAddress(await headers()));
  if (limited) {
    return { ok: false, message: limited };
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
  const limited = await paymentAttemptStatus("confirm", clientAddress(await headers()));
  if (limited) {
    return { ok: false, message: limited };
  }
  const result = await confirmTestPayment(reference, paymentId, signature);
  if (result.ok) {
    expirePublicCatalogue();
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${result.reference}`);
    revalidatePath(`/admin/orders/${result.reference}`);
  }
  return result;
}
