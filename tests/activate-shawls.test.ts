import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  activationFields,
  EXPECTED_IMPORTED_SHAWLS,
  planShawlActivation,
  type ActivationProduct,
  type ShawlIdentity,
} from "@/lib/catalogue/activate-shawls";
import { productShownPublicly } from "@/lib/catalogue/visibility";

function identity(index: number): ShawlIdentity {
  return {
    source: "Kani shawls",
    folderName: String(index),
    slug: `kani-${index}`,
    sku: `KL-KANI-${index}`,
  };
}

function product(index: number, patch: Partial<ActivationProduct> = {}): ActivationProduct {
  return {
    name: String(index),
    slug: `kani-${index}`,
    sku: `KL-KANI-${index}`,
    status: "draft",
    active: false,
    featured: false,
    category: "kani",
    pricePaise: 500_000,
    stockQuantity: 1,
    images: [{ url: `/Kani shawls/${index}/a.png` }],
    ...patch,
  };
}

function filesFor(count: number): Set<string> {
  return new Set(Array.from({ length: count }, (_, index) => `Kani shawls/${index + 1}/a.png`));
}

const categories = [{ slug: "kani", active: true }];

describe("shawl activation", () => {
  test("activates only the 30 imported shawls", () => {
    const identities = Array.from({ length: EXPECTED_IMPORTED_SHAWLS }, (_, index) => identity(index + 1));
    const products = [
      ...identities.map((_, index) => product(index + 1)),
      product(1, { name: "Nishat", slug: "nishat", sku: "KL-SAMPLE-NISHAT" }),
      product(1, { name: "Machine embroidery", slug: "machine-embroidery", sku: "ME-001", category: "machine-embroidery" }),
    ];
    const plan = planShawlActivation({ identities, products, categories, files: filesFor(EXPECTED_IMPORTED_SHAWLS) });
    assert.equal(plan.ok, true);
    if (!plan.ok) {
      return;
    }
    assert.equal(plan.rows.length, 30);
    assert.equal(plan.rows.every((row) => row.action === "activate"), true);
    assert.equal(plan.rows.some((row) => row.slug === "nishat" || row.sku === "ME-001"), false);
    assert.deepEqual(activationFields(), { status: "active", active: true });
    assert.equal(productShownPublicly("active"), true);
    assert.equal(productShownPublicly("draft"), false);
    assert.deepEqual(plan.rows[0]?.changes, ["status: active", "active: true"]);
  });

  test("aborts when a shawl is missing or the slug and SKU disagree", () => {
    const identities = [identity(1), identity(2)];
    const missing = planShawlActivation({
      identities,
      products: [product(1)],
      categories,
      files: filesFor(2),
      expectedCount: 2,
    });
    assert.equal(missing.ok, false);
    const conflict = planShawlActivation({
      identities,
      products: [
        product(1),
        product(2, { slug: "kani-2", sku: "KL-OTHER" }),
        product(2, { slug: "other", sku: "KL-KANI-2", name: "Other" }),
      ],
      categories,
      files: filesFor(2),
      expectedCount: 2,
    });
    assert.equal(conflict.ok, false);
    const duplicate = planShawlActivation({
      identities: [identity(1)],
      products: [product(1), product(1, { name: "Copy" })],
      categories,
      files: filesFor(1),
      expectedCount: 1,
    });
    assert.equal(duplicate.ok, false);
  });

  test("blocks a shawl with a missing image, a different price, or a different stock", () => {
    const identities = [identity(1), identity(2)];
    const plan = planShawlActivation({
      identities,
      products: [product(1), product(2, { pricePaise: 100, stockQuantity: 4, images: [{ url: "/Kani shawls/2/missing.png" }] })],
      categories,
      files: new Set(["Kani shawls/1/a.png"]),
      expectedCount: 2,
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) {
      return;
    }
    assert.equal(plan.rows[0]?.action, "activate");
    assert.equal(plan.rows[1]?.action, "blocked");
    assert.match(plan.rows[1]?.reason ?? "", /missing/);
    assert.match(plan.rows[1]?.reason ?? "", /100 paise/);
    assert.match(plan.rows[1]?.reason ?? "", /stock is 4/);
    const ready = planShawlActivation({
      identities: [identity(1)],
      products: [product(1, { status: "active", active: true })],
      categories,
      files: filesFor(1),
      expectedCount: 1,
    });
    assert.equal(ready.ok, true);
    if (ready.ok) {
      assert.equal(ready.rows[0]?.action, "already-active");
      assert.deepEqual(ready.rows[0]?.changes, []);
    }
  });
});
