import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { loadSeedEnv } from "@/scripts/load-env";
import { connectToDatabase, disconnectDatabase } from "@/lib/mongodb";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { WebhookEvent } from "@/lib/models/webhook-event";
import { createGuestOrder } from "@/lib/orders/create";
import { commitFulfilmentChange } from "@/lib/orders/fulfilment";
import { readTestCheckoutConfig } from "@/lib/payments/config";
import type { PaymentGateway, RemotePayment } from "@/lib/payments/gateway";
import { confirmTestPayment, prepareTestPayment, receiveWebhook, reconcileUnpaidOrder } from "@/lib/payments/service";
import { paymentSignature, webhookSignature } from "@/lib/payments/signature";

loadSeedEnv();

const SKU = "KL-P5B-PAY";
const PRICE = 125_000;
const savedEnv = {
  RAZORPAY_MODE: process.env.RAZORPAY_MODE,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
};

let nishatStock = 0;
let sequence = 0;

describe("test checkout payments", { concurrency: false }, () => {
  before(async () => {
    process.env.RAZORPAY_MODE = "test";
    process.env.RAZORPAY_KEY_ID = "rzp_test_kashmiriloom";
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret-value";
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret-value";
    await connectToDatabase();
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.ok(nishat);
    assert.equal(nishat.active, true);
    nishatStock = nishat.stockQuantity;
    await Order.deleteMany({ "lines.sku": SKU });
    await Product.deleteMany({ sku: SKU });
    await WebhookEvent.deleteMany({ eventId: /^evt_p5b/ });
    await Product.create(fixture());
  });

  beforeEach(async () => {
    await Order.deleteMany({ "lines.sku": SKU });
    await WebhookEvent.deleteMany({ eventId: /^evt_p5b/ });
    await Product.updateOne({ sku: SKU }, { stockQuantity: 4, active: true, pricePaise: PRICE });
  });

  after(async () => {
    await Order.deleteMany({ "lines.sku": SKU });
    await Product.deleteMany({ sku: SKU });
    await WebhookEvent.deleteMany({ eventId: /^evt_p5b/ });
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.equal(nishat?.active, true);
    assert.equal(nishat?.stockQuantity, nishatStock);
    restoreEnv();
    await disconnectDatabase();
  });

  test("rejects a checkout signature that was not made with the stored order", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    await attach(reference, orderId);
    const payment = remote(nextPaymentId(), orderId, PRICE, "captured");
    const { gateway, calls } = fake({ orderId, payment });
    const result = await confirmTestPayment(reference, payment.id, "a".repeat(64), gateway);
    assert.equal(result.ok, false);
    assert.equal(calls.fetched, 0);
    const stored = await read(reference);
    assert.equal(stored?.paymentStatus, "pending");
    assert.equal(await stock(), 3);
  });

  test("rejects an invalid webhook signature", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE, "captured");
    await attach(reference, orderId);
    const raw = webhookBody("payment.captured", payment.id);
    const { gateway } = fake({ orderId, payment });
    const result = await receiveWebhook(
      { rawBody: raw, signature: "b".repeat(64), eventId: nextEventId() },
      gateway,
    );
    assert.equal(result.status, 400);
    assert.equal(await WebhookEvent.countDocuments({ eventId: /^evt_p5b/ }), 0);
    assert.equal((await read(reference))?.paymentStatus, "pending");
    assert.equal(await stock(), 3);
  });

  test("does not mark an order paid when the captured amount differs", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE - 1, "captured");
    await attach(reference, orderId);
    const { gateway } = fake({ orderId, payment });
    const result = await confirmTestPayment(reference, payment.id, sign(orderId, payment.id), gateway);
    assert.equal(result.ok, false);
    assert.equal((await read(reference))?.paymentStatus, "pending");
    assert.equal(await stock(), 3);
  });

  test("does not mark an order paid when the payment belongs to another Razorpay order", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), nextOrderId(), PRICE, "captured");
    await attach(reference, orderId);
    const { gateway } = fake({ orderId, payment });
    const result = await confirmTestPayment(reference, payment.id, sign(orderId, payment.id), gateway);
    assert.equal(result.ok, false);
    assert.equal((await read(reference))?.paymentStatus, "pending");
    assert.equal((await read(reference))?.razorpayPaymentId, undefined);
    assert.equal(await stock(), 3);
  });

  test("processes one webhook delivery and ignores the duplicate", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE, "captured");
    await attach(reference, orderId);
    const raw = webhookBody("payment.captured", payment.id);
    const eventId = nextEventId();
    const { gateway } = fake({ orderId, payment });
    const first = await receiveWebhook(
      { rawBody: raw, signature: webhookSignature(raw, secret()), eventId },
      gateway,
    );
    const second = await receiveWebhook(
      { rawBody: raw, signature: webhookSignature(raw, secret()), eventId },
      gateway,
    );
    assert.equal(first.status, 200);
    assert.equal(first.duplicate, false);
    assert.equal(second.status, 200);
    assert.equal(second.duplicate, true);
    assert.equal(await WebhookEvent.countDocuments({ eventId }), 1);
    assert.equal(await Order.countDocuments({ "lines.sku": SKU }), 1);
    const stored = await read(reference);
    assert.equal(stored?.paymentStatus, "paid");
    assert.equal(stored?.razorpayPaymentId, payment.id);
    assert.equal(await stock(), 3);
  });

  test("records a failed payment without marking the order paid or changing stock again", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE, "failed");
    await attach(reference, orderId);
    const raw = webhookBody("payment.failed", payment.id);
    const { gateway } = fake({ orderId, payment });
    const result = await receiveWebhook(
      { rawBody: raw, signature: webhookSignature(raw, secret()), eventId: nextEventId() },
      gateway,
    );
    assert.equal(result.status, 200);
    const stored = await read(reference);
    assert.equal(stored?.paymentStatus, "failed");
    assert.equal(stored?.razorpayPaymentId, undefined);
    assert.equal(await stock(), 3);
  });

  test("confirms the same payment twice without a second order or stock change", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE, "captured");
    await attach(reference, orderId);
    const { gateway } = fake({ orderId, payment });
    const signature = sign(orderId, payment.id);
    const first = await confirmTestPayment(reference, payment.id, signature, gateway);
    const second = await confirmTestPayment(reference, payment.id, signature, gateway);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(await Order.countDocuments({ "lines.sku": SKU }), 1);
    const stored = await read(reference);
    assert.equal(stored?.paymentStatus, "paid");
    assert.equal(stored?.razorpayPaymentId, payment.id);
    assert.equal(await stock(), 3);
    await assert.rejects(Order.updateOne({ publicReference: reference }, { $set: { paymentStatus: "paid" } }));
  });

  test("rejects live mode and a live key without repeating the key", async () => {
    const liveKey = "rzp_live_examplekey";
    const byKey = readTestCheckoutConfig({
      RAZORPAY_MODE: "test",
      RAZORPAY_KEY_ID: liveKey,
      RAZORPAY_KEY_SECRET: "test-key-secret-value",
    });
    const byMode = readTestCheckoutConfig({
      RAZORPAY_MODE: "live",
      RAZORPAY_KEY_ID: "rzp_test_kashmiriloom",
      RAZORPAY_KEY_SECRET: "test-key-secret-value",
    });
    assert.equal(byKey.ok, false);
    assert.equal(byMode.ok, false);
    if (!byKey.ok && byKey.message.includes(liveKey)) {
      assert.fail("The rejection included a live key.");
    }
    if (!byMode.ok && byMode.message.includes(liveKey)) {
      assert.fail("The rejection included a live key.");
    }
  });

  test("keeps stock reserved when an expired order still has a created payment", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE, "created");
    await attach(reference, orderId, new Date(Date.now() - 60_000));
    const { gateway } = fake({ orderId, payment, payments: [payment] });
    await reconcileUnpaidOrder(reference, gateway);
    const stored = await read(reference);
    assert.equal(stored?.paymentStatus, "processing");
    assert.notEqual(stored?.paymentStatus, "paid");
    assert.equal(stored?.fulfilmentStatus, "pending");
    assert.equal(await stock(), 3);
  });

  test("returns stock once when an unpaid order expires with no Razorpay order", async () => {
    const reference = await place();
    await Order.updateOne({ publicReference: reference }, { $set: { paymentExpiresAt: new Date(Date.now() - 60_000) } });
    await reconcileUnpaidOrder(reference, null);
    const stored = await read(reference);
    assert.equal(stored?.paymentStatus, "expired");
    assert.equal(stored?.fulfilmentStatus, "cancelled");
    assert.equal(await stock(), 4);
    await reconcileUnpaidOrder(reference, null);
    assert.equal(await stock(), 4);
  });

  test("reuses the stored Razorpay order when payment is tried again", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const { gateway, calls } = fake({ orderId });
    const first = await prepareTestPayment(reference, gateway);
    const second = await prepareTestPayment(reference, gateway);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || first.alreadyPaid || !second.ok || second.alreadyPaid) {
      return;
    }
    assert.equal(first.orderId, orderId);
    assert.equal(second.orderId, orderId);
    assert.equal(first.amount, PRICE);
    assert.equal(first.currency, "INR");
    assert.equal(first.keyId.startsWith("rzp_test_"), true);
    assert.equal(calls.created, 1);
    assert.equal(await Order.countDocuments({ "lines.sku": SKU }), 1);
    assert.equal(await stock(), 3);
    const cancelled = await commitFulfilmentChange(reference, "cancelled");
    assert.equal(cancelled.ok, false);
    assert.equal(await stock(), 3);
  });

  test("marks an authorized payment paid only after a later fetch says captured", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const authorized = remote(nextPaymentId(), orderId, PRICE, "authorized");
    const captured = { ...authorized, status: "captured" };
    await attach(reference, orderId);
    const waiting = fake({ orderId, payment: authorized, refetch: authorized });
    const waitingResult = await confirmTestPayment(reference, authorized.id, sign(orderId, authorized.id), waiting.gateway);
    assert.equal(waitingResult.ok, false);
    assert.equal((await read(reference))?.paymentStatus, "processing");
    assert.equal(waiting.calls.captured[0], PRICE);
    assert.equal(await stock(), 3);

    const finishing = fake({ orderId, payment: authorized, refetch: captured });
    const finished = await confirmTestPayment(reference, authorized.id, sign(orderId, authorized.id), finishing.gateway);
    assert.equal(finished.ok, true);
    assert.equal((await read(reference))?.paymentStatus, "paid");
    assert.equal(finishing.calls.captured[0], PRICE);
    assert.equal(await stock(), 3);
  });

  test("leaves the order unpaid when the payment check times out", async () => {
    const reference = await place();
    const orderId = nextOrderId();
    const payment = remote(nextPaymentId(), orderId, PRICE, "captured");
    await attach(reference, orderId);
    const { gateway } = fake({ orderId, payment, failFetch: true });
    const result = await confirmTestPayment(reference, payment.id, sign(orderId, payment.id), gateway);
    assert.equal(result.ok, false);
    assert.equal((await read(reference))?.paymentStatus, "pending");
    assert.equal(await stock(), 3);
  });
});

function fake(behavior: {
  orderId: string;
  payment?: RemotePayment | null;
  payments?: RemotePayment[];
  refetch?: RemotePayment | null;
  failFetch?: boolean;
  createAmount?: number;
}) {
  const calls = { created: 0, captured: [] as number[], fetched: 0 };
  const gateway: PaymentGateway = {
    async createOrder(input) {
      calls.created += 1;
      return { id: behavior.orderId, amount: behavior.createAmount ?? input.amount, currency: "INR" };
    },
    async fetchPayment() {
      calls.fetched += 1;
      if (behavior.failFetch) {
        throw new Error("Razorpay request timed out.");
      }
      if (behavior.refetch && calls.fetched > 1) {
        return behavior.refetch;
      }
      return behavior.payment ?? null;
    },
    async listOrderPayments() {
      return behavior.payments ?? [];
    },
    async capturePayment(_paymentId, amount) {
      calls.captured.push(amount);
      return behavior.refetch ?? behavior.payment ?? remote("pay_P5Bcapture", behavior.orderId, amount, "captured");
    },
  };
  return { gateway, calls };
}

async function place() {
  const result = await createGuestOrder(guest());
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("The test order was not created.");
  }
  return result.reference;
}

async function attach(reference: string, orderId: string, paymentExpiresAt?: Date) {
  await Order.updateOne(
    { publicReference: reference },
    { $set: paymentExpiresAt ? { razorpayOrderId: orderId, paymentExpiresAt } : { razorpayOrderId: orderId } },
  );
}

async function read(reference: string) {
  return Order.findOne({ publicReference: reference })
    .select("paymentStatus fulfilmentStatus razorpayPaymentId razorpayOrderId")
    .lean<{
      paymentStatus: string;
      fulfilmentStatus: string;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
    } | null>();
}

async function stock() {
  const product = await Product.findOne({ sku: SKU }).select("stockQuantity").lean<{ stockQuantity: number } | null>();
  return product?.stockQuantity ?? -1;
}

function guest() {
  return {
    idempotencyKey: crypto.randomUUID(),
    lines: [{ slug: "phase-5b-pay", quantity: 1 }],
    contact: { name: "Phase Guest", email: "phase5b@example.com", phone: "9876543210" },
    address: {
      line1: "12 Test Lane",
      line2: "",
      city: "Srinagar",
      state: "Jammu and Kashmir" as const,
      postalCode: "190001",
      country: "IN" as const,
    },
  };
}

function fixture() {
  return {
    name: "Phase 5B pay",
    slug: "phase-5b-pay",
    description: "Temporary shawl used to test payment checks.",
    category: "everyday" as const,
    pricePaise: PRICE,
    images: [{ url: "/images/shawl-chinar.jpg", alt: "Folded test shawl" }],
    sku: SKU,
    stockQuantity: 4,
    active: true,
    featured: false,
    currency: "INR" as const,
  };
}

function remote(id: string, orderId: string, amount: number, status: string): RemotePayment {
  return { id, orderId, amount, currency: "INR", status };
}

function sign(orderId: string, paymentId: string) {
  return paymentSignature(orderId, paymentId, secretKey());
}

function secret() {
  return process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
}

function secretKey() {
  return process.env.RAZORPAY_KEY_SECRET ?? "";
}

function webhookBody(event: string, paymentId: string) {
  return JSON.stringify({ event, payload: { payment: { entity: { id: paymentId } } } });
}

function nextOrderId() {
  sequence += 1;
  return `order_P5B${sequence}`;
}

function nextPaymentId() {
  sequence += 1;
  return `pay_P5B${sequence}`;
}

function nextEventId() {
  sequence += 1;
  return `evt_p5b_${sequence}`;
}

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
