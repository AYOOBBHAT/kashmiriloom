import path from "node:path";
import { IMPORT_PRICE_RUPEES, IMPORT_STOCK_QUANTITY } from "@/lib/catalogue/shawl-import";
import { isImportedShawlImage } from "@/lib/products/images";
import { activeForStatus, statusFromRecord } from "@/lib/products/status";
import { parseInrToPaise } from "@/lib/products/validate";

export const EXPECTED_IMPORTED_SHAWLS = 30;

const expectedPrice = parseInrToPaise(IMPORT_PRICE_RUPEES);

export type ShawlIdentity = {
  source: string;
  folderName: string;
  slug: string;
  sku: string;
};

export type ActivationProduct = {
  name: string;
  slug: string;
  sku: string;
  status?: string;
  active: boolean;
  featured: boolean;
  category: string;
  pricePaise: number;
  stockQuantity: number;
  images: { url: string }[];
};

export type ActivationAction = "activate" | "already-active" | "blocked";

export type ActivationRow = {
  name: string;
  source: string;
  slug: string;
  sku: string;
  currentStatus: string;
  imageCount: number;
  pricePaise: number;
  stockQuantity: number;
  featured: boolean;
  action: ActivationAction;
  changes: string[];
  reason: string;
};

export function activationFields(): { status: "active"; active: true } {
  if (activeForStatus("active") !== true) {
    throw new Error("Active status must make a product public.");
  }
  return { status: "active", active: true };
}

export function publicImageFileKey(url: string): string | null {
  if (!isImportedShawlImage(url)) {
    return null;
  }
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return null;
  }
  const segments = decoded.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2 || segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return segments.join("/");
}

export function planShawlActivation(input: {
  identities: ShawlIdentity[];
  products: ActivationProduct[];
  categories: { slug: string; active: boolean }[];
  files: ReadonlySet<string>;
  expectedCount?: number;
}): { ok: true; rows: ActivationRow[] } | { ok: false; reason: string } {
  const expectedCount = input.expectedCount ?? EXPECTED_IMPORTED_SHAWLS;
  if (input.identities.length !== expectedCount) {
    return { ok: false, reason: `Expected ${expectedCount} imported shawls and found ${input.identities.length}. Nothing was written.` };
  }
  const slugs = new Set<string>();
  const skus = new Set<string>();
  for (const identity of input.identities) {
    if (slugs.has(identity.slug) || skus.has(identity.sku)) {
      return { ok: false, reason: `The import identity ${identity.slug} / ${identity.sku} is duplicated. Nothing was written.` };
    }
    slugs.add(identity.slug);
    skus.add(identity.sku);
  }
  if (expectedPrice === null) {
    return { ok: false, reason: "The expected shawl price could not be read. Nothing was written." };
  }

  const rows: ActivationRow[] = [];
  for (const identity of input.identities) {
    const bySlug = input.products.filter((product) => product.slug === identity.slug);
    const bySku = input.products.filter((product) => product.sku === identity.sku);
    if (bySlug.length > 1 || bySku.length > 1) {
      return { ok: false, reason: `More than one product matches ${identity.slug} or ${identity.sku}. Nothing was written.` };
    }
    const slugMatch = bySlug[0];
    const skuMatch = bySku[0];
    if (!slugMatch || !skuMatch) {
      return {
        ok: false,
        reason: `No product matches ${identity.source}/${identity.folderName} (${identity.slug} / ${identity.sku}). Nothing was written.`,
      };
    }
    if (slugMatch.slug !== skuMatch.slug || slugMatch.sku !== skuMatch.sku) {
      return {
        ok: false,
        reason: `Slug ${identity.slug} and SKU ${identity.sku} belong to different products. Nothing was written.`,
      };
    }
    rows.push(reviewProduct(identity, slugMatch, input.categories, input.files, expectedPrice));
  }
  return { ok: true, rows };
}

function reviewProduct(
  identity: ShawlIdentity,
  product: ActivationProduct,
  categories: { slug: string; active: boolean }[],
  files: ReadonlySet<string>,
  pricePaise: number,
): ActivationRow {
  const currentStatus = statusFromRecord(product.status, product.active);
  const base = {
    name: product.name,
    source: `${identity.source}/${identity.folderName}`,
    slug: product.slug,
    sku: product.sku,
    currentStatus,
    imageCount: product.images.length,
    pricePaise: product.pricePaise,
    stockQuantity: product.stockQuantity,
    featured: product.featured,
  };
  const problems: string[] = [];
  if (product.images.length < 1) {
    problems.push("It has no images.");
  }
  for (const image of product.images) {
    const key = publicImageFileKey(image.url);
    if (!key || !key.startsWith(`${identity.source}/`)) {
      problems.push("An image path is not in this shawl's public folder.");
      break;
    }
    if (!files.has(key)) {
      problems.push("An image file is missing from the public folder.");
      break;
    }
  }
  if (product.pricePaise !== pricePaise) {
    problems.push(`The price is ${product.pricePaise} paise, not ${pricePaise}.`);
  }
  if (product.stockQuantity !== IMPORT_STOCK_QUANTITY) {
    problems.push(`The stock is ${product.stockQuantity}, not ${IMPORT_STOCK_QUANTITY}.`);
  }
  const category = categories.find((item) => item.slug === product.category);
  if (!category?.active) {
    problems.push("Its category is not active.");
  }
  if (currentStatus === "archived") {
    problems.push("It is archived.");
  }
  if (problems.length > 0) {
    return {
      ...base,
      action: "blocked",
      changes: [],
      reason: `${problems.join(" ")} It was not activated.`,
    };
  }
  if (currentStatus === "active" && product.active === true) {
    return {
      ...base,
      action: "already-active",
      changes: [],
      reason: "Already active. Featured, price, stock, and images were left unchanged.",
    };
  }
  return {
    ...base,
    action: "activate",
    changes: ["status: active", "active: true"],
    reason: "Set status to active and active to true. Featured, price, stock, title, description, category, SKU, and images stay as saved.",
  };
}

export function isInsideDirectory(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
