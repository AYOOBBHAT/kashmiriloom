import "server-only";

import { isValidObjectId } from "mongoose";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getCurrentAdmin } from "@/lib/auth/session";
import { assertCategoryAssignment } from "@/lib/categories/records";
import { fallbackCategoryName } from "@/lib/categories/defaults";
import { loadCategoryNames } from "@/lib/categories/names";
import { CatalogueAccessError, UNAVAILABLE_MESSAGE, redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/lib/models/product";
import { ADMIN_PAGE_SIZE, LOW_STOCK_AT, type AdminListQuery, type AdminStatusFilter } from "@/lib/products/admin-query";
import { primaryOf } from "@/lib/products/gallery";
import { activeForStatus, statusFromRecord, type ProductStatus } from "@/lib/products/status";
import type { ProductDraft } from "@/lib/products/validate";

export class AdminAccessError extends Error {
  constructor() {
    super("Sign in required.");
    this.name = "AdminAccessError";
  }
}

export class CategoryReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryReferenceError";
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
  category: string;
  categoryName: string;
  pricePaise: number;
  stockQuantity: number;
  lowStock: boolean;
  active: boolean;
  status: ProductStatus;
  featured: boolean;
  imageUrl: string;
  imageAlt: string;
  updatedAt: string;
};

export type AdminProductDetail = AdminListItem & {
  description: string;
  shortDescription: string;
  compareAtPricePaise: number | null;
  images: { url: string; alt: string; primary: boolean }[];
  material: string;
  dimensions: string;
  care: string;
  color: string;
  weave: string;
  embroidery: string;
  size: string;
  variantGroup: string;
  variantLabel: string;
  collectionSlugs: string[];
  createdAt: string;
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
  category: string;
  pricePaise: number;
  stockQuantity: number;
  active: boolean;
  status?: ProductStatus;
  featured: boolean;
  updatedAt?: Date;
  createdAt?: Date;
  description?: string;
  shortDescription?: string;
  compareAtPricePaise?: number | null;
  images?: { url?: string; alt?: string; primary?: boolean }[];
  material?: string;
  dimensions?: string;
  care?: string;
  color?: string;
  weave?: string;
  embroidery?: string;
  size?: string;
  variantGroup?: string;
  variantLabel?: string;
  collectionSlugs?: string[];
};

const listFields = "name slug sku category pricePaise stockQuantity active status featured images updatedAt";
const detailFields = `${listFields} description shortDescription compareAtPricePaise material dimensions care color weave embroidery size variantGroup variantLabel collectionSlugs createdAt`;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isProductId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id) && isValidObjectId(id);
}

function toListItem(record: AdminRecord, names: Map<string, string>): AdminListItem {
  const images = (record.images ?? []).flatMap((image) =>
    image.url ? [{ url: image.url, alt: image.alt ?? "", primary: image.primary === true }] : [],
  );
  const image = primaryOf(images);
  const status = statusFromRecord(record.status, record.active);
  return {
    id: String(record._id),
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    category: record.category,
    categoryName: names.get(record.category) ?? fallbackCategoryName(record.category),
    pricePaise: record.pricePaise,
    stockQuantity: record.stockQuantity,
    lowStock: record.stockQuantity <= LOW_STOCK_AT,
    active: status === "active",
    status,
    featured: record.featured,
    imageUrl: image?.url ?? "",
    imageAlt: image?.alt ?? "",
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : "",
  };
}

function toDetail(record: AdminRecord, names: Map<string, string>): AdminProductDetail {
  const images = (record.images ?? []).flatMap((image) =>
    image.url ? [{ url: image.url, alt: image.alt ?? "", primary: image.primary === true }] : [],
  );
  const normalized = images.some((image) => image.primary)
    ? images
    : images.map((image, index) => ({ ...image, primary: index === 0 }));
  return {
    ...toListItem({ ...record, images: normalized }, names),
    description: record.description ?? "",
    shortDescription: record.shortDescription ?? "",
    compareAtPricePaise:
      typeof record.compareAtPricePaise === "number" ? record.compareAtPricePaise : null,
    images: normalized,
    material: record.material ?? "",
    dimensions: record.dimensions ?? "",
    care: record.care ?? "",
    color: record.color ?? "",
    weave: record.weave ?? "",
    embroidery: record.embroidery ?? "",
    size: record.size ?? "",
    variantGroup: record.variantGroup ?? "",
    variantLabel: record.variantLabel ?? "",
    collectionSlugs: record.collectionSlugs ?? [],
    createdAt: record.createdAt ? record.createdAt.toISOString() : "",
  };
}

function statusClause(status: AdminStatusFilter): Record<string, unknown> | null {
  if (status === "active") {
    return { active: true };
  }
  if (status === "draft") {
    return { status: "draft" };
  }
  if (status === "archived") {
    return { active: false, status: { $ne: "draft" } };
  }
  return null;
}

async function authorize() {
  const admin = await getCurrentAdmin();
  try {
    requireAdmin(admin);
  } catch {
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
      error instanceof DuplicateProductError ||
      error instanceof CategoryReferenceError
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
    const names = await loadCategoryNames();
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
      lowStock: lowStock.map((record) => toListItem(record, names)),
      recent: recent.map((record) => toListItem(record, names)),
    };
  });
}

export async function listAdminProducts(
  query: AdminListQuery,
): Promise<{ items: AdminListItem[]; total: number; page: number; pageCount: number }> {
  await authorize();
  return run(async () => {
    const names = await loadCategoryNames();
    const filter: Record<string, unknown> = {};
    if (query.category !== "all") {
      filter.category = query.category;
    }
    const clause = statusClause(query.status);
    if (clause) {
      Object.assign(filter, clause);
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
    return { items: items.map((record) => toListItem(record, names)), total, page, pageCount };
  });
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  await authorize();
  if (!isProductId(id)) {
    return null;
  }
  return run(async () => {
    const names = await loadCategoryNames();
    const record = await Product.findById(id).select(detailFields).lean<AdminRecord | null>();
    return record ? toDetail(record, names) : null;
  });
}

const OPTIONAL_TEXT = [
  "shortDescription",
  "material",
  "dimensions",
  "care",
  "color",
  "weave",
  "embroidery",
  "size",
  "variantGroup",
  "variantLabel",
] as const;

function mongoUpdate(draft: ProductDraft) {
  const $set: Record<string, unknown> = {
    name: draft.name,
    slug: draft.slug,
    description: draft.description,
    category: draft.category,
    collectionSlugs: draft.collectionSlugs,
    pricePaise: draft.pricePaise,
    sku: draft.sku,
    stockQuantity: draft.stockQuantity,
    active: activeForStatus(draft.status),
    status: draft.status,
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
  for (const field of OPTIONAL_TEXT) {
    if (draft[field]) {
      $set[field] = draft[field];
    } else {
      $unset[field] = "";
    }
  }
  return { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) };
}

async function rememberPreviousSlug(id: string, previousSlug: string, nextSlug: string) {
  if (previousSlug === nextSlug) {
    return;
  }
  await Product.updateMany({ previousSlugs: nextSlug }, { $pull: { previousSlugs: nextSlug } });
  await Product.updateOne({ _id: id }, { $addToSet: { previousSlugs: previousSlug } });
}

async function linkVariantSource(draft: ProductDraft) {
  if (!draft.linkSourceId || !draft.variantGroup || !isProductId(draft.linkSourceId)) {
    return;
  }
  await Product.updateOne(
    {
      _id: draft.linkSourceId,
      $or: [{ variantGroup: { $exists: false } }, { variantGroup: "" }, { variantGroup: draft.variantGroup }],
    },
    { $set: { variantGroup: draft.variantGroup } },
  );
}

export async function createAdminProduct(draft: ProductDraft): Promise<string> {
  await authorize();
  return run(async () => {
    const categoryError = await assertCategoryAssignment(draft.category, draft.collectionSlugs, draft.status);
    if (categoryError) {
      throw new CategoryReferenceError(categoryError);
    }
    const created = await Product.create({
      ...mongoUpdate(draft).$set,
      currency: "INR",
    });
    await linkVariantSource(draft);
    return String(created._id);
  });
}

export async function updateAdminProduct(id: string, draft: ProductDraft): Promise<boolean> {
  await authorize();
  if (!isProductId(id)) {
    return false;
  }
  return run(async () => {
    const current = await Product.findById(id).select("slug category updatedAt").lean<{
      slug: string;
      category: string;
      updatedAt?: Date;
    } | null>();
    if (!current) {
      return false;
    }
    if (draft.expectedUpdatedAt && current.updatedAt && current.updatedAt.toISOString() !== draft.expectedUpdatedAt) {
      throw new CatalogueAccessError("unavailable", "This shawl was saved elsewhere. Reload it and try again.");
    }
    const categoryError = await assertCategoryAssignment(
      draft.category,
      draft.collectionSlugs,
      draft.status,
      current.category,
    );
    if (categoryError) {
      throw new CategoryReferenceError(categoryError);
    }
    const result = await Product.updateOne({ _id: id }, mongoUpdate(draft));
    if (result.matchedCount === 0) {
      return false;
    }
    await rememberPreviousSlug(id, current.slug, draft.slug);
    return true;
  });
}

export async function deactivateAdminProduct(id: string): Promise<boolean> {
  await authorize();
  if (!isProductId(id)) {
    return false;
  }
  return run(async () => {
    const result = await Product.updateOne({ _id: id }, { $set: { active: false, status: "archived" } });
    return result.matchedCount > 0;
  });
}
