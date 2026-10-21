import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { loadSeedEnv } from "@/scripts/load-env";
import { connectToDatabase, disconnectDatabase } from "@/lib/mongodb";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { createGuestOrder } from "@/lib/orders/create";
import { commitFulfilmentChange } from "@/lib/orders/fulfilment";
import { readPublicOrder } from "@/lib/orders/lookup";
import { packViewCookie } from "@/lib/orders/view-cookie";

loadSeedEnv();

const SKUS = ["KL-P5A-HOLD", "KL-P5A-LOW", "KL-P5A-QUIET"] as const;
const EMAIL = "phase5a@example.com";

let nishatStock = 0;

describe("guest orders", { concurrency: false }, () => {
  before(async () => {
    await connectToDatabase();
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.ok(nishat);
    assert.equal(nishat.active, true);
    nishatStock = nishat.stockQuantity;
    await Order.deleteMany({ "lines.sku": { $in: [...SKUS] } });
    await Product.deleteMany({ sku: { $in: [...SKUS] } });
    await Product.create([
      fixture("phase-5a-hold", "KL-P5A-HOLD", "Phase 5A hold", 125_000, 4, true),
      fixture("phase-5a-low", "KL-P5A-LOW", "Phase 5A low", 80_000, 1, true),
      fixture("phase-5a-quiet", "KL-P5A-QUIET", "Phase 5A quiet", 50_000, 4, false),
    ]);
  });

  beforeEach(async () => {
    await Order.deleteMany({ "lines.sku": { $in: [...SKUS] } });
    await Product.updateOne({ sku: "KL-P5A-HOLD" }, { stockQuantity: 4, active: true, pricePaise: 125_000 });
    await Product.updateOne({ sku: "KL-P5A-LOW" }, { stockQuantity: 1, active: true, pricePaise: 80_000 });
    await Product.updateOne({ sku: "KL-P5A-QUIET" }, { stockQuantity: 4, active: false, pricePaise: 50_000 });
  });

  after(async () => {
    await Order.deleteMany({ "lines.sku": { $in: [...SKUS] } });
    await Product.deleteMany({ sku: { $in: [...SKUS] } });
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.equal(nishat?.active, true);
    assert.equal(nishat?.stockQuantity, nishatStock);
    await disconnectDatabase();
  });

  test("ignores client prices, totals, and payment status", async () => {
    const result = await createGuestOrder({
      ...guest([{ slug: "phase-5a-hold", quantity: 1 }]),
      lines: [{ slug: "phase-5a-hold", quantity: 1, unitPricePaise: 100 }],
      subtotalPaise: 1,
      shippingPaise: 999,
      taxPaise: 50,
      totalPaise: 1,
      paymentStatus: "paid",
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const order = await Order.findOne({ publicReference: result.reference }).lean();
    assert.ok(order);
    assert.equal(order.lines[0]?.unitPricePaise, 125_000);
    assert.equal(order.subtotalPaise, 125_000);
    assert.equal(order.shippingPaise, 0);
    assert.equal(order.taxPaise, 0);
    assert.equal(order.totalPaise, 125_000);
    assert.equal(order.paymentStatus, "pending");
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 3);
  });

  test("rejects an inactive product without reserving quantity", async () => {
    const result = await createGuestOrder(guest([{ slug: "phase-5a-quiet", quantity: 1 }]));
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.match(result.message, /not available/);
    assert.equal(result.message.includes("Mongo"), false);
    assert.equal((await stock("KL-P5A-QUIET"))?.stockQuantity, 4);
    assert.equal(await Order.countDocuments({ "lines.sku": "KL-P5A-QUIET" }), 0);
  });

  test("rejects insufficient stock and rolls back a partial reservation", async () => {
    const input = guest([
      { slug: "phase-5a-hold", quantity: 1 },
      { slug: "phase-5a-low", quantity: 5 },
    ]);
    const result = await createGuestOrder(input);
    assert.equal(result.ok, false);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 4);
    assert.equal((await stock("KL-P5A-LOW"))?.stockQuantity, 1);
    assert.equal(await Order.countDocuments({ idempotencyKey: input.idempotencyKey }), 0);
  });

  test("rolls back a sequential partial reservation when transactions are not used", async () => {
    const result = await createGuestOrder(
      guest([
        { slug: "phase-5a-hold", quantity: 2 },
        { slug: "phase-5a-low", quantity: 4 },
      ]),
      { reservation: "sequential" },
    );
    assert.equal(result.ok, false);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 4);
    assert.equal((await stock("KL-P5A-LOW"))?.stockQuantity, 1);
  });

  test("rejects invalid quantities before reserving stock", async () => {
    for (const quantity of [0, -1, 1.5, 10, "9.5"]) {
      const before = (await stock("KL-P5A-HOLD"))?.stockQuantity;
      const result = await createGuestOrder(guest([{ slug: "phase-5a-hold", quantity }]));
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.fields.lines ?? "", /Quantity/);
      }
      assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, before);
    }
    assert.equal(await Order.countDocuments({ "lines.sku": "KL-P5A-HOLD" }), 0);
  });

  test("treats a repeated checkout as the same order", async () => {
    const input = guest([{ slug: "phase-5a-hold", quantity: 1 }]);
    const first = await createGuestOrder(input);
    const second = await createGuestOrder(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.reference, second.reference);
    assert.equal(await Order.countDocuments({ idempotencyKey: input.idempotencyKey }), 1);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 3);
  });

  test("parallel submissions reserve the shawl once", async () => {
    const input = guest([{ slug: "phase-5a-hold", quantity: 1 }]);
    const [first, second] = await Promise.all([createGuestOrder(input), createGuestOrder(input)]);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.reference, second.reference);
    assert.equal(await Order.countDocuments({ idempotencyKey: input.idempotencyKey }), 1);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 3);
  });

  test("a changed retry does not reserve the shawl again", async () => {
    const input = guest([{ slug: "phase-5a-hold", quantity: 1 }]);
    const first = await createGuestOrder(input);
    assert.equal(first.ok, true);
    const second = await createGuestOrder({
      ...input,
      contact: { ...input.contact, phone: "9123456789" },
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, "mismatch");
    }
    assert.equal(await Order.countDocuments({ idempotencyKey: input.idempotencyKey }), 1);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 3);
  });

  test("hides contact and address unless the view cookie matches", async () => {
    const result = await createGuestOrder(guest([{ slug: "phase-5a-hold", quantity: 1 }]));
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const hidden = await readPublicOrder(result.reference, undefined);
    assert.ok(hidden);
    assert.equal(hidden.contact, null);
    assert.equal(hidden.address, null);
    assert.equal(JSON.stringify(hidden).includes(EMAIL), false);
    assert.equal(JSON.stringify(hidden).includes("Test Lane"), false);
    const wrong = await readPublicOrder(result.reference, packViewCookie(result.reference, "a".repeat(64)));
    assert.equal(wrong?.contact, null);
    const shown = await readPublicOrder(result.reference, packViewCookie(result.reference, result.viewToken));
    assert.equal(shown?.contact?.email, EMAIL);
    assert.equal(shown?.address?.line1, "12 Test Lane");
    assert.equal(shown?.paymentStatus, "pending");
  });

  test("cancellation returns quantity once and cannot mark the order paid", async () => {
    const result = await createGuestOrder(guest([{ slug: "phase-5a-hold", quantity: 2 }]));
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 2);
    const cancelled = await commitFulfilmentChange(result.reference, "cancelled");
    assert.equal(cancelled.ok, true);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 4);
    const again = await commitFulfilmentChange(result.reference, "cancelled");
    assert.equal(again.ok, true);
    assert.equal((await stock("KL-P5A-HOLD"))?.stockQuantity, 4);
    const reopened = await commitFulfilmentChange(result.reference, "shipped");
    assert.equal(reopened.ok, false);
    let rejected = false;
    try {
      await Order.updateOne({ publicReference: result.reference }, { $set: { paymentStatus: "paid" } });
    } catch {
      rejected = true;
    }
    const order = await Order.findOne({ publicReference: result.reference }).select("paymentStatus fulfilmentStatus").lean();
    assert.equal(rejected, true);
    assert.equal(order?.paymentStatus, "pending");
    assert.equal(order?.fulfilmentStatus, "cancelled");
  });
});

function guest(lines: { slug: string; quantity: unknown }[]) {
  return {
    idempotencyKey: crypto.randomUUID(),
    lines,
    contact: {
      name: "Phase Guest",
      email: EMAIL,
      phone: "9876543210",
    },
    address: {
      line1: "12 Test Lane",
      line2: "",
      city: "Srinagar",
      state: "Jammu and Kashmir",
      postalCode: "190001",
      country: "IN",
    },
  };
}

function fixture(slug: string, sku: string, name: string, pricePaise: number, stockQuantity: number, active: boolean) {
  return {
    name,
    slug,
    description: "Temporary shawl used to test order reservation.",
    category: "everyday" as const,
    pricePaise,
    images: [{ url: "/images/shawl-chinar.jpg", alt: "Folded test shawl" }],
    sku,
    stockQuantity,
    active,
    featured: false,
    currency: "INR" as const,
  };
}

async function stock(sku: string) {
  return Product.findOne({ sku }).select("stockQuantity").lean<{ stockQuantity: number } | null>();
}
