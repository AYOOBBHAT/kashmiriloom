import "server-only";

import type { ClientSession } from "mongoose";
import { redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Order, type OrderLineRecord } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { isPublicReference } from "@/lib/orders/reference";
import { FULFILMENT_STATUSES, type FulfilmentStatus } from "@/lib/orders/status";
import { isRetryableTransaction, runOrderTransaction, transactionsUnsupported } from "@/lib/orders/transaction";

export type FulfilmentResult =
  | { ok: true; status: FulfilmentStatus }
  | { ok: false; message: string };

type StoredOrder = {
  publicReference: string;
  fulfilmentStatus: FulfilmentStatus;
  paymentStatus: string;
  razorpayOrderId?: string;
  lines: OrderLineRecord[];
};

export function parseFulfilmentStatus(value: unknown): FulfilmentStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  return FULFILMENT_STATUSES.find((status) => status === value) ?? null;
}

export async function commitFulfilmentChange(reference: string, status: unknown): Promise<FulfilmentResult> {
  const next = parseFulfilmentStatus(status);
  if (!isPublicReference(reference) || !next) {
    return { ok: false, message: "Choose a fulfilment status for a known order." };
  }
  await connectToDatabase();
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await runOrderTransaction((session) => change(reference, next, session));
      } catch (error) {
        if (transactionsUnsupported(error)) {
          return change(reference, next, null);
        }
        if (isRetryableTransaction(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === "missing-product") {
      return { ok: false, message: "A shawl on this order is no longer in the catalogue, so it was not cancelled." };
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Fulfilment update failed: ${redactSecrets(detail)}`);
    return { ok: false, message: "The fulfilment status could not be saved." };
  }
  return { ok: false, message: "The fulfilment status could not be saved." };
}

async function change(
  reference: string,
  next: FulfilmentStatus,
  session: ClientSession | null,
): Promise<FulfilmentResult> {
  const order = await Order.findOne({ publicReference: reference })
    .session(session)
    .select("publicReference fulfilmentStatus paymentStatus razorpayOrderId lines")
    .lean<StoredOrder | null>();
  if (!order) {
    return { ok: false, message: "That order is not in the desk." };
  }
  if (order.fulfilmentStatus === "cancelled" && next !== "cancelled") {
    return { ok: false, message: "This order is closed. Its quantity has already been returned." };
  }
  if (order.fulfilmentStatus === next) {
    return { ok: true, status: next };
  }
  if (next === "cancelled" && (order.paymentStatus === "paid" || order.paymentStatus === "processing" || order.razorpayOrderId)) {
    return {
      ok: false,
      message: "This order cannot be cancelled while a test payment is open, confirming, or already paid. The quantity stays reserved.",
    };
  }
  const restored: OrderLineRecord[] = [];
  try {
    if (next === "cancelled") {
      for (const line of order.lines) {
        const result = await Product.updateOne(
          { _id: line.productId },
          { $inc: { stockQuantity: line.quantity } },
          { session: session ?? undefined },
        );
        if (result.matchedCount !== 1) {
          throw new Error("missing-product");
        }
        restored.push(line);
      }
    }
    const updated = await Order.findOneAndUpdate(
      { publicReference: reference, fulfilmentStatus: order.fulfilmentStatus },
      { $set: { fulfilmentStatus: next } },
      { session: session ?? undefined, returnDocument: "after" },
    );
    if (!updated) {
      throw new Error("Fulfilment changed while it was being saved.");
    }
    return { ok: true, status: next };
  } catch (error) {
    if (!session) {
      for (const line of restored) {
        await Product.updateOne({ _id: line.productId }, { $inc: { stockQuantity: -line.quantity } });
      }
    }
    throw error;
  }
}
