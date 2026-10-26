import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { validateCategoryDraft, DuplicateCategoryError } from "@/lib/categories/records";
import {
  categorySaveNotice,
  categoryShownPublicly,
  productSaveNotice,
  productShownPublicly,
} from "@/lib/catalogue/visibility";
import { categoryMembership } from "@/lib/products/membership";
import { activeForStatus } from "@/lib/products/status";
import { validateProductDraft } from "@/lib/products/validate";

const categoryInput = {
  name: "Pashmina",
  slug: "pashmina",
  description: "Fine wool shawls.",
  imageUrl: "",
  imageAlt: "",
  active: true,
  displayOrder: "2",
  expectedUpdatedAt: "",
};

function productInput(status: string, extra: { sku?: string; collectionSlugs?: string[]; featured?: boolean } = {}) {
  return {
    name: "Test shawl",
    slug: "test-shawl",
    description: "A shawl used by the visibility test.",
    shortDescription: "",
    category: "pashmina",
    collectionSlugs: extra.collectionSlugs ?? [],
    priceRupees: "1250",
    compareAtRupees: "",
    sku: extra.sku ?? "KL-VIS-1",
    stockQuantity: "4",
    status,
    featured: extra.featured === true,
    images: [{ url: "/images/shawl-nishat.jpg", alt: "A test photograph", primary: true }],
    material: "",
    dimensions: "",
    care: "",
    color: "",
    weave: "",
    embroidery: "",
    size: "",
    variantGroup: "",
    variantLabel: "",
    expectedUpdatedAt: "",
    linkSourceId: "",
  };
}

describe("catalogue visibility rules", () => {
  test("accepts an active category and keeps an inactive one out of the public catalogue", () => {
    const created = validateCategoryDraft(categoryInput);
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.slug, "pashmina");
    assert.equal(created.value.active, true);
    assert.equal(created.value.displayOrder, 2);
    assert.equal(categoryShownPublicly(created.value.active), true);
    const hidden = validateCategoryDraft({ ...categoryInput, active: false });
    assert.equal(hidden.ok, true);
    if (hidden.ok) {
      assert.equal(categoryShownPublicly(hidden.value.active), false);
    }
    assert.match(categorySaveNotice(true), /homepage/);
    assert.match(categorySaveNotice(false), /stays off the shop/);
  });

  test("rejects a duplicate-style slug and a slug that is not a collection address", () => {
    const invalid = validateCategoryDraft({ ...categoryInput, slug: "Pashmina Shawls" });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.match(invalid.errors.slug ?? "", /lowercase slug/);
    }
    const conflict = new DuplicateCategoryError();
    assert.match(conflict.message, /already used/);
  });

  test("saves a product as a draft by default rules and hides it from the shop", () => {
    const draft = validateProductDraft(productInput("draft", { featured: true }));
    assert.equal(draft.ok, true);
    if (!draft.ok) {
      return;
    }
    assert.equal(draft.value.status, "draft");
    assert.equal(draft.value.category, "pashmina");
    assert.equal(draft.value.featured, false);
    assert.equal(activeForStatus(draft.value.status), false);
    assert.equal(productShownPublicly(draft.value.status), false);
    assert.match(productSaveNotice("draft"), /stays off the shop/);
  });

  test("lists an active product in its category and extra collections, and hides an archived one", () => {
    const active = validateProductDraft(productInput("active", { collectionSlugs: ["kani"], featured: true }));
    assert.equal(active.ok, true);
    if (!active.ok) {
      return;
    }
    assert.equal(productShownPublicly(active.value.status), true);
    assert.equal(active.value.featured, true);
    assert.equal(active.value.pricePaise, 125_000);
    assert.deepEqual(active.value.collectionSlugs, ["kani"]);
    assert.deepEqual(categoryMembership(active.value.category), {
      $or: [{ category: "pashmina" }, { collectionSlugs: "pashmina" }],
    });
    const archived = validateProductDraft(productInput("archived"));
    assert.equal(archived.ok, true);
    if (archived.ok) {
      assert.equal(productShownPublicly(archived.value.status), false);
    }
    assert.match(productSaveNotice("active"), /shop/);
    assert.match(productSaveNotice("archived"), /hidden from the shop/);
  });

  test("rejects a conflicting SKU shape, a missing image, and a collection that repeats the category", () => {
    const sku = validateProductDraft(productInput("active", { sku: "not a sku" }));
    assert.equal(sku.ok, false);
    if (!sku.ok) {
      assert.match(sku.errors.sku ?? "", /SKU/);
    }
    const images = validateProductDraft({ ...productInput("active"), images: [] });
    assert.equal(images.ok, false);
    if (!images.ok) {
      assert.match(images.errors.images ?? "", /1 and 6/);
    }
    const same = validateProductDraft(productInput("active", { collectionSlugs: ["pashmina"] }));
    assert.equal(same.ok, false);
    if (!same.ok) {
      assert.match(same.errors.collectionSlugs ?? "", /other categories/);
    }
    const products = readFileSync("lib/products/admin-repository.ts", "utf8");
    assert.match(products, /That SKU is already used/);
    assert.match(products, /That slug is already used/);
  });

  test("footer and save actions follow the public category list and refresh the shared layout", () => {
    const footer = readFileSync("components/site-footer.tsx", "utf8");
    assert.match(footer, /listPublicCategories/);
    assert.doesNotMatch(footer, /collections\.map/);
    const categories = readFileSync("app/admin/category-actions.ts", "utf8");
    const products = readFileSync("app/admin/actions.ts", "utf8");
    assert.match(categories, /revalidatePath\("\/", "layout"\)/);
    assert.match(products, /revalidatePath\("\/", "layout"\)/);
    const repository = readFileSync("lib/products/repository.ts", "utf8");
    assert.match(repository, /active: true/);
    const publicCategories = readFileSync("lib/categories/public.ts", "utf8");
    assert.match(publicCategories, /Category\.find\(\{ active: true \}\)/);
  });
});
