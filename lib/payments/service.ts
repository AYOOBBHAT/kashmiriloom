import "server-only";

import type { ClientSession } from "mongoose";
import { redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Order, type OrderLineRecord } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { WebhookEvent } from "@/lib/models/webhook-event";
import { isPublicReference } from "@/lib/orders/reference";
import type { FulfilmentStatus } from "@/lib/orders/status";
import { runOrderTransaction, transactionsUnsupported } from "@/lib/orders/transaction";
import { readTestCheckoutConfig, readWebhookSecret } from "@/lib/payments/config";
import type { PaymentGateway, RemotePayment } from "@/lib/payments/gateway";
import { livePaymentGateway } from "@/lib/payments/razorpay";
import { paymentSignature, signaturesMatch, webhookSignature } from "@/lib/payments/signature";
import { UNPAID_HOLD_MS, type PaymentStatus } from "@/lib/payments/status";
import { withVerifiedPayment } from "@/lib/payments/verified";

const ORDER_ID = /^order_[A-Za-z0-9]+$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;
const EVENT_ID = /^[A-Za-z0-9_-]{8,80}$/;

const NOT_CONFIRMED = "The payment was not confirmed. This order stays unpaid.";

export type PreparePaymentResult =
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

export type ConfirmPaymentResult = { ok: true; reference: string } | { ok: false; message: string };

export type WebhookResult = { status: number; duplicate: boolean };

type PayableOrder = {
  publicReference: string;
  totalPaise: number;
  currency: "INR";
  paymentStatus: PaymentStatus;
  fulfilmentStatus: string;
  razorpayOrderId?: string;
  paymentExpiresAt?: Date;
  createdAt?: Date;
  lines: OrderLineRecord[];
};

export async function prepareTestPayment(
  reference: string,
  gateway: PaymentGateway | null = livePaymentGateway(),
  now = Date.now(),
): Promise<PreparePaymentResult> {
  const config = readTestCheckoutConfig();
  if (!config.ok) {
    return { ok: false, message: config.message };
  }
  if (!gateway) {
    return { ok: false, message: NOT_CONFIRMED };
  }
  const order = await loadOrder(reference);
  if (!order) {
    return { ok: false, message: "That order is not available for payment." };
  }
  if (order.paymentStatus === "paid") {
    return { ok: true, alreadyPaid: true, reference: order.publicReference };
  }
  if (order.fulfilmentStatus === "cancelled" || order.paymentStatus === "expired") {
    return { ok: false, message: "This order is closed and cannot be paid." };
  }
  await reconcileUnpaidOrder(order.publicReference, gateway, now);
  const current = await loadOrder(reference);
  if (!current || current.paymentStatus === "expired" || current.fulfilmentStatus === "cancelled") {
    return { ok: false, message: "The reservation ended before payment was confirmed." };
  }
  if (current.paymentStatus === "paid") {
    return { ok: true, alreadyPaid: true, reference: current.publicReference };
  }
  if (current.currency !== "INR") {
    return { ok: false, message: NOT_CONFIRMED };
  }
  const orderId = current.razorpayOrderId ?? (await createProviderOrder(current, gateway));
  if (!orderId) {
    return { ok: false, message: NOT_CONFIRMED };
  }
  return {
    ok: true,
    alreadyPaid: false,
    reference: current.publicReference,
    keyId: config.config.keyId,
    orderId,
    amount: current.totalPaise,
    currency: "INR",
    description: `KashmiriLoom ${current.publicReference}`,
  };
}

export async function confirmTestPayment(
  reference: string,
  paymentId: string,
  signature: string,
  gateway: PaymentGateway | null = livePaymentGateway(),
): Promise<ConfirmPaymentResult> {
  const config = readTestCheckoutConfig();
  if (!config.ok || !gateway) {
    return { ok: false, message: config.ok ? NOT_CONFIRMED : config.message };
  }
  if (!PAYMENT_ID.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) {
    return { ok: false, message: NOT_CONFIRMED };
  }
  const order = await loadOrder(reference);
  if (!order?.razorpayOrderId) {
    return { ok: false, message: NOT_CONFIRMED };
  }
  if (order.paymentStatus === "paid") {
    return { ok: true, reference: order.publicReference };
  }
  const expected = paymentSignature(order.razorpayOrderId, paymentId, config.config.keySecret);
  if (!signaturesMatch(expected, signature)) {
    return { ok: false, message: NOT_CONFIRMED };
  }
  try {
    const payment = await gateway.fetchPayment(paymentId);
    const settled = await settlePayment(order.publicReference, payment, gateway);
    return settled ? { ok: true, reference: order.publicReference } : { ok: false, message: NOT_CONFIRMED };
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "payment-retry") {
      logPaymentError(error);
    }
    return { ok: false, message: NOT_CONFIRMED };
  }
}

export async function receiveWebhook(
  input: { rawBody: string; signature: string; eventId: string },
  gateway: PaymentGateway | null = livePaymentGateway(),
): Promise<WebhookResult> {
  const secret = readWebhookSecret();
  if (!secret) {
    return { status: 503, duplicate: false };
  }
  const expected = webhookSignature(input.rawBody, secret);
  if (!signaturesMatch(expected, input.signature)) {
    return { status: 400, duplicate: false };
  }
  if (!EVENT_ID.test(input.eventId)) {
    return { status: 400, duplicate: false };
  }
  if (!readTestCheckoutConfig().ok || !gateway) {
    return { status: 503, duplicate: false };
  }
  await connectToDatabase();
  const seen = await WebhookEvent.findOne({ eventId: input.eventId }).select("eventId").lean();
  if (seen) {
    return { status: 200, duplicate: true };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { status: 400, duplicate: false };
  }
  const eventName = readEventName(parsed);
  const hinted = readPaymentHint(parsed);
  if (!eventName) {
    return { status: 400, duplicate: false };
  }
  try {
    if (hinted && (eventName === "payment.captured" || eventName === "order.paid" || eventName === "payment.failed")) {
      const payment = await gateway.fetchPayment(hinted.paymentId);
      const order = payment
        ? await Order.findOne({ razorpayOrderId: payment.orderId }).select("publicReference").lean<{ publicReference: string } | null>()
        : null;
      if (order && payment) {
        if (eventName === "payment.failed") {
          await recordFailure(order.publicReference, payment);
        } else {
          await settlePayment(order.publicReference, payment, gateway);
        }
      }
    }
    await WebhookEvent.create({ eventId: input.eventId, eventName });
    return { status: 200, duplicate: false };
  } catch (error) {
    if (duplicateEvent(error)) {
      return { status: 200, duplicate: true };
    }
    if (error instanceof Error && error.message === "payment-retry") {
      return { status: 500, duplicate: false };
    }
    logPaymentError(error);
    return { status: 500, duplicate: false };
  }
}

export async function reconcileUnpaidOrder(
  reference: string,
  gateway: PaymentGateway | null,
  now = Date.now(),
): Promise<void> {
  const order = await loadOrder(reference);
  if (!order || order.paymentStatus === "paid" || order.paymentStatus === "expired" || order.fulfilmentStatus === "cancelled") {
    return;
  }
  if (!holdEnded(order, now)) {
    return;
  }
  if (!order.razorpayOrderId) {
    await releaseHold(order.publicReference);
    return;
  }
  if (!gateway) {
    return;
  }
  try {
    const payments = await gateway.listOrderPayments(order.razorpayOrderId);
    const captured = payments.find((payment) => payment.status === "captured");
    if (captured) {
      await settlePayment(order.publicReference, captured, gateway);
      return;
    }
    const authorized = payments.find((payment) => payment.status === "authorized");
    if (authorized) {
      await settlePayment(order.publicReference, authorized, gateway);
      return;
    }
    if (payments.some((payment) => payment.status === "created")) {
      await setStatus(order.publicReference, "processing", ["pending", "failed"]);
      return;
    }
    await releaseHold(order.publicReference);
  } catch (error) {
    logPaymentError(error);
  }
}

async function createProviderOrder(order: PayableOrder, gateway: PaymentGateway): Promise<string | null> {
  let created: { id: string; amount: number; currency: string };
  try {
    created = await gateway.createOrder({
      amount: order.totalPaise,
      currency: "INR",
      receipt: order.publicReference,
    });
  } catch (error) {
    logPaymentError(error);
    return null;
  }
  if (!ORDER_ID.test(created.id) || created.amount !== order.totalPaise || created.currency !== "INR") {
    return null;
  }
  const saved = await Order.findOneAndUpdate(
    {
      publicReference: order.publicReference,
      paymentStatus: { $in: ["pending", "failed"] },
      $or: [{ razorpayOrderId: { $exists: false } }, { razorpayOrderId: "" }],
    },
    { $set: { razorpayOrderId: created.id } },
    { returnDocument: "after" },
  ).lean<{ razorpayOrderId?: string } | null>();
  if (saved?.razorpayOrderId && ORDER_ID.test(saved.razorpayOrderId)) {
    return saved.razorpayOrderId;
  }
  const current = await loadOrder(order.publicReference);
  return current?.razorpayOrderId && ORDER_ID.test(current.razorpayOrderId) ? current.razorpayOrderId : null;
}

async function settlePayment(
  reference: string,
  payment: RemotePayment | null,
  gateway: PaymentGateway,
): Promise<boolean> {
  const order = await loadOrder(reference);
  if (!order?.razorpayOrderId || !payment) {
    return false;
  }
  if (order.paymentStatus === "paid") {
    return true;
  }
  if (payment.orderId !== order.razorpayOrderId || payment.currency !== "INR") {
    return false;
  }
  if (payment.amount !== order.totalPaise) {
    return false;
  }
  if (payment.status === "failed") {
    await recordFailure(reference, payment);
    return false;
  }
  if (payment.status === "created") {
    await setStatus(reference, "processing", ["pending", "failed"]);
    return false;
  }
  let captured = payment;
  if (payment.status === "authorized") {
    await setStatus(reference, "processing", ["pending", "failed"]);
    try {
      await gateway.capturePayment(payment.id, order.totalPaise);
      captured = (await gateway.fetchPayment(payment.id)) ?? { ...payment, status: "authorized" };
    } catch (error) {
      logPaymentError(error);
      throw new Error("payment-retry");
    }
  }
  if (captured.status !== "captured" || captured.amount !== order.totalPaise || captured.currency !== "INR" || captured.orderId !== order.razorpayOrderId) {
    if (payment.status === "authorized") {
      throw new Error("payment-retry");
    }
    return false;
  }
  await withVerifiedPayment(async () => {
    await Order.updateOne(
      {
        publicReference: reference,
        razorpayOrderId: order.razorpayOrderId,
        totalPaise: order.totalPaise,
        paymentStatus: { $in: ["pending", "processing", "failed", "expired"] },
      },
      { $set: { paymentStatus: "paid", razorpayPaymentId: captured.id } },
    );
  });
  const paid = await Order.findOne({ publicReference: reference, paymentStatus: "paid" }).select("publicReference").lean();
  return Boolean(paid);
}

async function recordFailure(reference: string, payment: RemotePayment): Promise<void> {
  const order = await loadOrder(reference);
  if (!order || order.paymentStatus === "paid" || payment.orderId !== order.razorpayOrderId || payment.status !== "failed") {
    return;
  }
  if (payment.amount !== order.totalPaise || payment.currency !== "INR") {
    return;
  }
  await setStatus(reference, "failed", ["pending", "processing"]);
}

async function setStatus(reference: string, status: PaymentStatus, from: PaymentStatus[]): Promise<void> {
  await withVerifiedPayment(async () => {
    await Order.updateOne(
      { publicReference: reference, paymentStatus: { $in: from } },
      { $set: { paymentStatus: status } },
    );
  });
}

async function releaseHold(reference: string): Promise<void> {
  await connectToDatabase();
  try {
    await withVerifiedPayment(async () => {
      await runOrderTransaction((session) => releaseInSession(reference, session));
    });
  } catch (error) {
    if (transactionsUnsupported(error)) {
      await withVerifiedPayment(async () => {
        await releaseInSession(reference, null);
      });
      return;
    }
    logPaymentError(error);
  }
}

async function releaseInSession(reference: string, session: ClientSession | null): Promise<void> {
  const order = await Order.findOne({
    publicReference: reference,
    paymentStatus: { $in: ["pending", "failed"] },
    fulfilmentStatus: { $ne: "cancelled" },
  })
    .session(session)
    .select("lines paymentStatus fulfilmentStatus")
    .lean<{ lines: OrderLineRecord[]; paymentStatus: PaymentStatus; fulfilmentStatus: FulfilmentStatus } | null>();
  if (!order) {
    return;
  }
  const restored: OrderLineRecord[] = [];
  try {
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
    const updated = await Order.findOneAndUpdate(
      { publicReference: reference, paymentStatus: order.paymentStatus, fulfilmentStatus: order.fulfilmentStatus },
      { $set: { paymentStatus: "expired", fulfilmentStatus: "cancelled" } },
      { session: session ?? undefined, returnDocument: "after" },
    );
    if (!updated) {
      throw new Error("The unpaid hold could not be closed.");
    }
  } catch (error) {
    if (!session) {
      for (const line of restored) {
        await Product.updateOne({ _id: line.productId }, { $inc: { stockQuantity: -line.quantity } });
      }
    }
    throw error;
  }
}

async function loadOrder(reference: string): Promise<PayableOrder | null> {
  if (!isPublicReference(reference)) {
    return null;
  }
  await connectToDatabase();
  const order = await Order.findOne({ publicReference: reference })
    .select("publicReference totalPaise currency paymentStatus fulfilmentStatus razorpayOrderId paymentExpiresAt createdAt lines")
    .lean<PayableOrder | null>();
  if (!order || order.currency !== "INR") {
    return null;
  }
  return order;
}

function holdEnded(order: PayableOrder, now: number): boolean {
  const expiry = order.paymentExpiresAt?.getTime() ?? (order.createdAt ? order.createdAt.getTime() + UNPAID_HOLD_MS : 0);
  return expiry > 0 && expiry <= now;
}

function readEventName(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("event" in value) || typeof value.event !== "string") {
    return null;
  }
  return value.event.slice(0, 80);
}

function readPaymentHint(value: unknown): { paymentId: string } | null {
  if (!value || typeof value !== "object" || !("payload" in value)) {
    return null;
  }
  const payload = value.payload;
  if (!payload || typeof payload !== "object" || !("payment" in payload)) {
    return null;
  }
  const payment = payload.payment;
  if (!payment || typeof payment !== "object" || !("entity" in payment)) {
    return null;
  }
  const entity = payment.entity;
  if (!entity || typeof entity !== "object" || !("id" in entity) || typeof entity.id !== "string" || !PAYMENT_ID.test(entity.id)) {
    return null;
  }
  return { paymentId: entity.id };
}

function duplicateEvent(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}

function logPaymentError(error: unknown): void {
  const detail = error instanceof Error ? error.message : "Unknown payment error";
  console.error(`Payment check failed: ${redactSecrets(detail)}`);
}
