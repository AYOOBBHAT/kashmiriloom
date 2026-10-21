import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { getCollectionBySlug } from "@/data/catalog";
import { withPrimaryImage } from "@/lib/products/gallery";
import type { ProductStatus } from "@/lib/products/status";
import { categoryMembership } from "@/lib/products/membership";
import { primaryOf } from "@/lib/products/gallery";
import { loadSeedEnv } from "@/scripts/load-env";
import { connectToDatabase, disconnectDatabase } from "@/lib/mongodb";
import { Category } from "@/lib/models/category";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import {
  CategoryInUseError,
  assertCategoryAssignment,
  createCategoryRecord,
  deleteCategoryRecord,
  updateCategoryRecord,
} from "@/lib/categories/records";
import { MissingAdminError, requireAdmin } from "@/lib/auth/require-admin";
import { createGuestOrder } from "@/lib/orders/create";

loadSeedEnv();

const SLUG = "cat-admin-weave";
const MOVED = "cat-admin-weave-renamed";
const SKUS = ["KL-CAT-ONE", "KL-CAT-TWO", "KL-CAT-ARCH", "KL-CAT-OLD"] as const;

let nishatStock = 0;

function product(
  slug: string,
  sku: string,
  active: boolean,
  extra: {
    category?: string;
    color?: string;
    pricePaise?: number;
    stockQuantity?: number;
    variantGroup?: string;
    variantLabel?: string;
  } = {},
) {
  const status: ProductStatus = active ? "active" : "archived";
  return {
    name: slug,
    slug,
    description: "Catalogue admin test shawl.",
    category: extra.category ?? SLUG,
    pricePaise: extra.pricePaise ?? 90_000,
    images: [
      { url: "/images/shawl-chinar.jpg", alt: "First photograph", primary: false },
      { url: "/images/shawl-nishat.jpg", alt: "Primary photograph", primary: true },
    ],
    sku,
    stockQuantity: extra.stockQuantity ?? 2,
    active,
    status,
    featured: false,
    currency: "INR" as const,
    ...(extra.color ? { color: extra.color } : {}),
    ...(extra.variantGroup ? { variantGroup: extra.variantGroup } : {}),
    ...(extra.variantLabel ? { variantLabel: extra.variantLabel } : {}),
  };
}

function guest(slug: string) {
  return {
    idempotencyKey: crypto.randomUUID(),
    lines: [{ slug, quantity: 1 }],
    contact: { name: "Catalogue Guest", email: "catalogue@example.com", phone: "9876543210" },
    address: {
      line1: "12 Test Lane",
      line2: "",
      city: "Srinagar",
      state: "Jammu and Kashmir",
      postalCode: "190001",
      country: "IN" as const,
    },
  };
}

describe("catalogue administration", { concurrency: false }, () => {
  before(async () => {
    await connectToDatabase();
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active slug").lean<{
      stockQuantity: number;
      active: boolean;
      slug: string;
    } | null>();
    assert.ok(nishat);
    assert.equal(nishat.active, true);
    assert.equal(nishat.slug, "nishat");
    nishatStock = nishat.stockQuantity;
    await Order.deleteMany({ "lines.sku": { $in: [...SKUS] } });
    await Product.deleteMany({ sku: { $in: [...SKUS] } });
    await Category.deleteMany({ slug: { $in: [SLUG, MOVED] } });
  });

  after(async () => {
    await Order.deleteMany({ "lines.sku": { $in: [...SKUS] } });
    await Product.deleteMany({ sku: { $in: [...SKUS] } });
    await Category.deleteMany({ slug: { $in: [SLUG, MOVED] } });
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.equal(nishat?.active, true);
    assert.equal(nishat?.stockQuantity, nishatStock);
    await disconnectDatabase();
  });

  test("keeps the original collection route and marks one primary image", () => {
    assert.equal(getCollectionBySlug("kani")?.slug, "kani");
    const images = withPrimaryImage([
      { url: "/images/shawl-chinar.jpg", alt: "First" },
      { url: "/images/shawl-nishat.jpg", alt: "Second", primary: true },
    ]);
    assert.equal(images[1]?.primary, true);
    assert.equal(images[0]?.primary, false);
    assert.deepEqual(categoryMembership("kani"), { $or: [{ category: "kani" }, { collectionSlugs: "kani" }] });
  });

  test("rejects a missing admin and does not treat a customer id as an admin", () => {
    assert.throws(() => requireAdmin(null), MissingAdminError);
    const productAdmin = readFileSync("lib/products/admin-repository.ts", "utf8");
    const categoryAdmin = readFileSync("lib/categories/admin.ts", "utf8");
    for (const name of ["createAdminProduct", "updateAdminProduct", "deactivateAdminProduct", "listAdminProducts"]) {
      const start = productAdmin.indexOf(`export async function ${name}`);
      assert.match(productAdmin.slice(start, start + 220), /await authorize\(\)/);
    }
    for (const name of ["listManagedCategories", "createManagedCategory", "updateManagedCategory", "deleteManagedCategory"]) {
      const start = categoryAdmin.indexOf(`export async function ${name}`);
      assert.match(categoryAdmin.slice(start, start + 180), /await authorize\(\)/);
    }
  });

  test("creates, lists, edits, and archives shawls in one category", async () => {
    const categoryId = await createCategoryRecord({
      name: "Admin weave",
      slug: SLUG,
      description: "A category used only by the catalogue test.",
      active: true,
      displayOrder: 9,
    });
    await Product.create([
      product("cat-admin-one", "KL-CAT-ONE", true, { color: "ivory", variantGroup: "cat-admin-design", variantLabel: "Ivory" }),
      product("cat-admin-two", "KL-CAT-TWO", true, { color: "forest", variantGroup: "cat-admin-design", variantLabel: "Forest", pricePaise: 110_000 }),
      product("cat-admin-arch", "KL-CAT-ARCH", false),
    ]);
    const listed = await Product.find({ ...categoryMembership(SLUG), active: true }).select("slug images color variantGroup").lean<
      Array<{ slug: string; images: { url: string; primary?: boolean }[]; color?: string; variantGroup?: string }>
    >();
    assert.deepEqual(listed.map((item) => item.slug).sort(), ["cat-admin-one", "cat-admin-two"]);
    const primary = primaryOf(listed.find((item) => item.slug === "cat-admin-one")?.images ?? []);
    assert.equal(primary?.url, "/images/shawl-nishat.jpg");
    const variants = await Product.find({ active: true, variantGroup: "cat-admin-design", slug: { $ne: "cat-admin-one" } }).select("slug").lean<Array<{ slug: string }>>();
    assert.equal(variants.some((item) => item.slug === "cat-admin-two"), true);
    assert.equal(await Product.countDocuments({ slug: "cat-admin-arch", active: true }), 0);
    await Product.updateOne({ sku: "KL-CAT-ONE" }, { $set: { name: "Renamed shawl", pricePaise: 95_000, slug: "cat-admin-one-new" }, $addToSet: { previousSlugs: "cat-admin-one" } });
    const redirect = await Product.findOne({ active: true, previousSlugs: "cat-admin-one" }).select("slug").lean<{ slug: string } | null>();
    assert.equal(redirect?.slug, "cat-admin-one-new");
    const archived = await createGuestOrder(guest("cat-admin-arch"));
    assert.equal(archived.ok, false);
    assert.equal(categoryId.length, 24);
  });

  test("rejects a duplicate slug and an unknown category", async () => {
    await assert.rejects(() => Product.create(product("cat-admin-two", "KL-CAT-DUP", true)));
    const message = await assertCategoryAssignment("missing-category", [], "active");
    assert.match(message ?? "", /does not exist/);
  });

  test("refuses to delete a category that still has shawls and redirects its old slug", async () => {
    const category = await Category.findOne({ slug: SLUG }).select("_id").lean<{ _id: unknown } | null>();
    assert.ok(category);
    await assert.rejects(() => deleteCategoryRecord(String(category._id)), CategoryInUseError);
    const updated = await updateCategoryRecord(String(category._id), {
      name: "Admin weave renamed",
      slug: MOVED,
      description: "A category used only by the catalogue test.",
      active: true,
      displayOrder: 9,
    });
    assert.equal(updated, true);
    const movedProduct = await Product.findOne({ sku: "KL-CAT-ONE" }).select("category").lean<{ category: string } | null>();
    assert.equal(movedProduct?.category, MOVED);
    const route = await Category.findOne({ previousSlugs: SLUG, active: true }).select("slug").lean<{ slug: string } | null>();
    assert.equal(route?.slug, MOVED);
    await Product.deleteMany({ sku: { $in: [...SKUS] } });
    const removed = await deleteCategoryRecord(String(category._id));
    assert.equal(removed, true);
  });

  test("leaves a historical order unchanged after the shawl is edited", async () => {
    await Product.create(product("cat-admin-old", "KL-CAT-OLD", true, { category: "everyday", stockQuantity: 3, pricePaise: 70_000 }));
    const created = await createGuestOrder(guest("cat-admin-old"));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await Product.updateOne({ sku: "KL-CAT-OLD" }, { $set: { name: "Changed after order", pricePaise: 10_000, category: "kani" } });
    const order = await Order.findOne({ publicReference: created.reference }).lean();
    assert.equal(order?.lines[0]?.name, "cat-admin-old");
    assert.equal(order?.lines[0]?.unitPricePaise, 70_000);
    assert.equal(order?.lines[0]?.sku, "KL-CAT-OLD");
    assert.equal(order?.totalPaise, 70_000);
  });

  test("reserves one of two concurrent checkouts", async () => {
    await Product.updateOne({ sku: "KL-CAT-OLD" }, { $set: { stockQuantity: 1, active: true, status: "active", pricePaise: 70_000 } });
    const results = await Promise.all([createGuestOrder(guest("cat-admin-old")), createGuestOrder(guest("cat-admin-old"))]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    const saved = await Product.findOne({ sku: "KL-CAT-OLD" }).select("stockQuantity").lean<{ stockQuantity: number } | null>();
    assert.equal(saved?.stockQuantity, 0);
  });
});
