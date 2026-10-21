import "server-only";

import { isValidObjectId } from "mongoose";
import type { CollectionId } from "@/data/catalog";
import { getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError, UNAVAILABLE_MESSAGE, redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/lib/models/product";
import { ADMIN_PAGE_SIZE, LOW_STOCK_AT, type AdminListQuery } from "@/lib/products/admin-query";
import type { ProductDraft } from "@/lib/products/validate";

export class AdminAccessError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "AdminAccessError";
  }
}

export class DuplicateProductError extends Error {
  readonly field: "slug" | "sku";

  constructor(field: "slug" | "sku") {
    super(field === "slug" ? "That slug is already used." : "That SKU is already used.");
    this.name = "DuplicateProductError";
    this.field = field;
  }
}

export type AdminListItem = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: CollectionId;
  pricePaise: number;
  stockQuantity: number;
  active: boolean;
  featured: boolean;
  updatedAt: string;
};

export type AdminProductDetail = AdminListItem & {
  description: string;
  compareAtPricePaise: number | null;
  images: { url: string; alt: string }[];
  material: string;
  dimensions: string;
  care: string;
};

export type AdminOverview = {
  total: number;
  active: number;
  inactive: number;
  lowStockCount: number;
  lowStock: AdminListItem[];
  recent: AdminListItem[];
};

type AdminRecord = {
  _id: unknown;
  name: string;
  slug: string;
  sku: string;
  category: CollectionId;
  pricePaise: number;
  stockQuantity: number;
  active: boolean;
  featured: boolean;
  updatedAt?: Date;
  description?: string;
  compareAtPricePaise?: number | null;
  images?: { url?: string; alt?: string }[];
  material?: string;
  dimensions?: string;
  care?: string;
};

const listFields = "name slug sku category pricePaise stockQuantity active featured updatedAt";
const detailFields = `${listFields} description compareAtPricePaise images material dimensions care`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isProductId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id) && isValidObjectId(id);
}

function toListItem(record: AdminRecord): AdminListItem {
  return {
    id: String(record._id),
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    category: record.category,
    pricePaise: record.pricePaise,
    stockQuantity: record.stockQuantity,
    active: record.active,
    featured: record.featured,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : "",
  };
}

function toDetail(record: AdminRecord): AdminProductDetail {
  return {
    ...toListItem(record),
    description: record.description ?? "",
    compareAtPricePaise:
      typeof record.compareAtPricePaise === "number" ? record.compareAtPricePaise : null,
    images: (record.images ?? []).flatMap((image) =>
      image.url ? [{ url: image.url, alt: image.alt ?? "" }] : [],
    ),
    material: record.material ?? "",
    dimensions: record.dimensions ?? "",
    care: record.care ?? "",
  };
}

async function authorize() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new AdminAccessError();
  }
  return admin;
}

function duplicateFrom(error: unknown): "slug" | "sku" | null {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) {
    return null;
  }
  const pattern =
    "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object"
      ? error.keyPattern
      : "keyValue" in error && error.keyValue && typeof error.keyValue === "object"
        ? error.keyValue
        : {};
  if ("slug" in pattern) {
    return "slug";
  }
  if ("sku" in pattern) {
    return "sku";
  }
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  if (/\bslug\b/i.test(message)) {
    return "slug";
  }
  if (/\bsku\b/i.test(message)) {
    return "sku";
  }
  return null;
}

function duplicateField(error: unknown): "slug" | "sku" | null {
  const direct = duplicateFrom(error);
  if (direct) {
    return direct;
  }
  if (error && typeof error === "object" && "cause" in error) {
    return duplicateFrom(error.cause);
  }
  return null;
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    await connectToDatabase();
    return await work();
  } catch (error) {
    if (
      error instanceof CatalogueAccessError ||
      error instanceof AdminAccessError ||
      error instanceof DuplicateProductError
    ) {
      throw error;
    }
    const duplicate = duplicateField(error);
    if (duplicate) {
      throw new DuplicateProductError(duplicate);
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Admin catalogue query failed: ${redactSecrets(detail)}`);
    throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
  }
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await authorize();
  return run(async () => {
    const [total, active, inactive, lowStockCount, lowStock, recent] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ active: true }),
      Product.countDocuments({ active: false }),
      Product.countDocuments({ stockQuantity: { $lte: LOW_STOCK_AT } }),
      Product.find({ stockQuantity: { $lte: LOW_STOCK_AT } })
        .select(listFields)
        .sort({ stockQuantity: 1, name: 1 })
        .limit(8)
        .lean<AdminRecord[]>(),
      Product.find({})
        .select(listFields)
        .sort({ updatedAt: -1, name: 1 })
        .limit(6)
        .lean<AdminRecord[]>(),
    ]);
    return {
      total,
      active,
      inactive,
      lowStockCount,
      lowStock: lowStock.map(toListItem),
      recent: recent.map(toListItem),
    };
  });
}

export async function listAdminProducts(
  query: AdminListQuery,
): Promise<{ items: AdminListItem[]; total: number; page: number; pageCount: number }> {
  await authorize();
  return run(async () => {
    const filter: Record<string, unknown> = {};
    if (query.category !== "all") {
      filter.category = query.category;
    }
    if (query.status === "active") {
      filter.active = true;
    } else if (query.status === "inactive") {
      filter.active = false;
    }
    if (query.search) {
      const pattern = escapeRegex(query.search.slice(0, 80));
      filter.$or = [
        { name: { $regex: pattern, $options: "i" } },
        { slug: { $regex: pattern, $options: "i" } },
        { sku: { $regex: pattern, $options: "i" } },
      ];
    }
    const total = await Product.countDocuments(filter);
    const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
    const page = Math.min(query.page, pageCount);
    const items = await Product.find(filter)
      .select(listFields)
      .sort({ updatedAt: -1, name: 1 })
      .skip((page - 1) * ADMIN_PAGE_SIZE)
      .limit(ADMIN_PAGE_SIZE)
      .lean<AdminRecord[]>();
    return { items: items.map(toListItem), total, page, pageCount };
  });
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  await authorize();
  if (!isProductId(id)) {
    return null;
  }
  return run(async () => {
    const record = await Product.findById(id).select(detailFields).lean<AdminRecord | null>();
    return record ? toDetail(record) : null;
  });
}

function mongoUpdate(draft: ProductDraft) {
  const $set: Record<string, unknown> = {
    name: draft.name,
    slug: draft.slug,
    description: draft.description,
    category: draft.category,
    pricePaise: draft.pricePaise,
    sku: draft.sku,
    stockQuantity: draft.stockQuantity,
    active: draft.active,
    featured: draft.featured,
    images: draft.images,
    currency: "INR",
  };
  const $unset: Record<string, ""> = {};
  if (draft.compareAtPricePaise !== undefined) {
    $set.compareAtPricePaise = draft.compareAtPricePaise;
  } else {
    $unset.compareAtPricePaise = "";
  }
  for (const field of ["material", "dimensions", "care"] as const) {
    if (draft[field]) {
      $set[field] = draft[field];
    } else {
      $unset[field] = "";
    }
  }
  return { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) };
}

export async function createAdminProduct(draft: ProductDraft): Promise<string> {
  await authorize();
  return run(async () => {
    const created = await Product.create({ ...draft, currency: "INR" });
    return String(created._id);
  });
}

export async function updateAdminProduct(id: string, draft: ProductDraft): Promise<boolean> {
  await authorize();
  if (!isProductId(id)) {
    return false;
  }
  return run(async () => {
    const result = await Product.updateOne({ _id: id }, mongoUpdate(draft));
    return result.matchedCount > 0;
  });
}

export async function deactivateAdminProduct(id: string): Promise<boolean> {
  await authorize();
  if (!isProductId(id)) {
    return false;
  }
  return run(async () => {
    const result = await Product.updateOne({ _id: id }, { $set: { active: false } });
    return result.matchedCount > 0;
  });
}
