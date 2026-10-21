import "server-only";

import { isValidObjectId } from "mongoose";
import { isSlug } from "@/lib/catalogue/slug";
import { CatalogueAccessError, UNAVAILABLE_MESSAGE, redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/lib/models/category";
import { Product } from "@/lib/models/product";
import { isApprovedImageUrl } from "@/lib/products/images";

export class DuplicateCategoryError extends Error {
  constructor() {
    super("That category slug is already used.");
    this.name = "DuplicateCategoryError";
  }
}

export class CategoryInUseError extends Error {
  readonly productCount: number;

  constructor(productCount: number) {
    super("This category still has shawls. Deactivate it, or move the shawls first.");
    this.name = "CategoryInUseError";
    this.productCount = productCount;
  }
}

export type CategoryDraft = {
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  active: boolean;
  displayOrder: number;
  expectedUpdatedAt?: string;
};

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  imageAlt: string;
  active: boolean;
  displayOrder: number;
  activeProductCount: number;
  productCount: number;
  updatedAt: string;
};

export type CategoryDetail = CategoryListItem & {
  description: string;
  createdAt: string;
};

const PAGE_SIZE = 20;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function duplicateSlug(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) {
    return false;
  }
  const pattern =
    "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object"
      ? error.keyPattern
      : {};
  if ("slug" in pattern) {
    return true;
  }
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return /\bslug\b/i.test(message);
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    await connectToDatabase();
    return await work();
  } catch (error) {
    if (
      error instanceof CatalogueAccessError ||
      error instanceof DuplicateCategoryError ||
      error instanceof CategoryInUseError
    ) {
      throw error;
    }
    if (duplicateSlug(error)) {
      throw new DuplicateCategoryError();
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Category write failed: ${redactSecrets(detail)}`);
    throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
  }
}

export function validateCategoryDraft(input: {
  name: unknown;
  slug: unknown;
  description: unknown;
  imageUrl: unknown;
  imageAlt: unknown;
  active: unknown;
  displayOrder: unknown;
  expectedUpdatedAt: unknown;
}): { ok: true; value: CategoryDraft } | { ok: false; errors: Record<string, string>; message: string } {
  const errors: Record<string, string> = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  const imageAlt = typeof input.imageAlt === "string" ? input.imageAlt.trim() : "";
  const orderText = typeof input.displayOrder === "string" ? input.displayOrder.trim() : "";
  const expectedUpdatedAt = typeof input.expectedUpdatedAt === "string" ? input.expectedUpdatedAt.trim() : "";

  if (name.length < 1 || name.length > 80) {
    errors.name = "Enter a name of 80 characters or fewer.";
  }
  if (!isSlug(slug)) {
    errors.slug = "Use a lowercase slug such as kani.";
  }
  if (description.length < 1 || description.length > 500) {
    errors.description = "Enter a description of 500 characters or fewer.";
  }
  if (imageUrl && !isApprovedImageUrl(imageUrl)) {
    errors.imageUrl = "Use an existing photograph or an image uploaded to this house's Cloudinary account.";
  }
  if (imageUrl && (imageAlt.length < 1 || imageAlt.length > 300)) {
    errors.imageAlt = "Describe the image in 300 characters or fewer.";
  }
  if (!/^\d{1,5}$/.test(orderText)) {
    errors.displayOrder = "Enter a display order from 0 to 10000.";
  }
  const displayOrder = Number(orderText);
  if (Number.isInteger(displayOrder) && displayOrder > 10_000) {
    errors.displayOrder = "Enter a display order from 0 to 10000.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: "Check the highlighted fields." };
  }
  return {
    ok: true,
    value: {
      name,
      slug,
      description,
      active: input.active === true,
      displayOrder,
      ...(imageUrl ? { imageUrl, imageAlt } : {}),
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    },
  };
}

async function productCounts(): Promise<Map<string, { active: number; total: number }>> {
  const rows = await Product.aggregate<{ _id: string; total: number; active: number }>([
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        active: { $sum: { $cond: ["$active", 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id, { active: row.active, total: row.total }]));
}

export async function listCategoryRecords(search: string, page: number): Promise<{
  items: CategoryListItem[];
  total: number;
  page: number;
  pageCount: number;
}> {
  return run(async () => {
    const filter: Record<string, unknown> = {};
    if (search) {
      const pattern = escapeRegex(search.slice(0, 80));
      filter.$or = [{ name: { $regex: pattern, $options: "i" } }, { slug: { $regex: pattern, $options: "i" } }];
    }
    const total = await Category.countDocuments(filter);
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(page, pageCount);
    const [docs, counts] = await Promise.all([
      Category.find(filter)
        .select("name slug imageUrl imageAlt active displayOrder updatedAt")
        .sort({ displayOrder: 1, name: 1 })
        .skip((current - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<
          Array<{
            _id: unknown;
            name: string;
            slug: string;
            imageUrl?: string;
            imageAlt?: string;
            active: boolean;
            displayOrder: number;
            updatedAt?: Date;
          }>
        >(),
      productCounts(),
    ]);
    return {
      total,
      page: current,
      pageCount,
      items: docs.map((record) => ({
        id: String(record._id),
        name: record.name,
        slug: record.slug,
        imageUrl: record.imageUrl ?? "",
        imageAlt: record.imageAlt ?? "",
        active: record.active,
        displayOrder: record.displayOrder,
        activeProductCount: counts.get(record.slug)?.active ?? 0,
        productCount: counts.get(record.slug)?.total ?? 0,
        updatedAt: record.updatedAt ? record.updatedAt.toISOString() : "",
      })),
    };
  });
}

export async function categoryChoices(): Promise<{ slug: string; name: string; active: boolean }[]> {
  return run(async () => {
    const docs = await Category.find({})
      .select("slug name active")
      .sort({ displayOrder: 1, name: 1 })
      .limit(100)
      .lean<Array<{ slug: string; name: string; active: boolean }>>();
    return docs;
  });
}

export async function getCategoryRecord(id: string): Promise<CategoryDetail | null> {
  if (!/^[a-f\d]{24}$/i.test(id) || !isValidObjectId(id)) {
    return null;
  }
  return run(async () => {
    const record = await Category.findById(id)
      .select("name slug description imageUrl imageAlt active displayOrder createdAt updatedAt")
      .lean<{
        _id: unknown;
        name: string;
        slug: string;
        description: string;
        imageUrl?: string;
        imageAlt?: string;
        active: boolean;
        displayOrder: number;
        createdAt?: Date;
        updatedAt?: Date;
      } | null>();
    if (!record) {
      return null;
    }
    const counts = await productCounts();
    return {
      id: String(record._id),
      name: record.name,
      slug: record.slug,
      description: record.description,
      imageUrl: record.imageUrl ?? "",
      imageAlt: record.imageAlt ?? "",
      active: record.active,
      displayOrder: record.displayOrder,
      activeProductCount: counts.get(record.slug)?.active ?? 0,
        productCount: counts.get(record.slug)?.total ?? 0,
      createdAt: record.createdAt ? record.createdAt.toISOString() : "",
      updatedAt: record.updatedAt ? record.updatedAt.toISOString() : "",
    };
  });
}

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const current = await Category.findOne({ slug }).select("_id").lean<{ _id: unknown } | null>();
  if (current && String(current._id) !== exceptId) {
    return true;
  }
  const previous = await Category.findOne({ previousSlugs: slug }).select("_id").lean<{ _id: unknown } | null>();
  return Boolean(previous && String(previous._id) !== exceptId);
}

export async function createCategoryRecord(draft: CategoryDraft): Promise<string> {
  return run(async () => {
    if (await slugTaken(draft.slug)) {
      throw new DuplicateCategoryError();
    }
    const created = await Category.create({
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      active: draft.active,
      displayOrder: draft.displayOrder,
      ...(draft.imageUrl ? { imageUrl: draft.imageUrl, imageAlt: draft.imageAlt } : {}),
    });
    return String(created._id);
  });
}

export async function updateCategoryRecord(id: string, draft: CategoryDraft): Promise<boolean> {
  if (!/^[a-f\d]{24}$/i.test(id) || !isValidObjectId(id)) {
    return false;
  }
  return run(async () => {
    const current = await Category.findById(id).select("slug updatedAt").lean<{ slug: string; updatedAt?: Date } | null>();
    if (!current) {
      return false;
    }
    if (draft.expectedUpdatedAt && current.updatedAt && current.updatedAt.toISOString() !== draft.expectedUpdatedAt) {
      throw new CatalogueAccessError("unavailable", "This category was saved elsewhere. Reload it and try again.");
    }
    if (await slugTaken(draft.slug, id)) {
      throw new DuplicateCategoryError();
    }
    const $set: Record<string, unknown> = {
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      active: draft.active,
      displayOrder: draft.displayOrder,
    };
    const $unset: Record<string, ""> = {};
    if (draft.imageUrl) {
      $set.imageUrl = draft.imageUrl;
      $set.imageAlt = draft.imageAlt;
    } else {
      $unset.imageUrl = "";
      $unset.imageAlt = "";
    }
    if (current.slug !== draft.slug) {
      await Product.updateMany({ category: current.slug }, { $set: { category: draft.slug } });
      await Product.updateMany(
        { collectionSlugs: current.slug },
        { $set: { "collectionSlugs.$[entry]": draft.slug } },
        { arrayFilters: [{ entry: current.slug }] },
      );
      await Category.updateOne(
        { _id: id },
        { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}), $addToSet: { previousSlugs: current.slug } },
      );
      await Category.updateOne({ _id: id }, { $pull: { previousSlugs: draft.slug } });
      return true;
    }
    await Category.updateOne({ _id: id }, { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) });
    return true;
  });
}

export async function setCategoryActive(id: string, active: boolean): Promise<boolean> {
  if (!/^[a-f\d]{24}$/i.test(id) || !isValidObjectId(id)) {
    return false;
  }
  return run(async () => {
    const result = await Category.updateOne({ _id: id }, { $set: { active } });
    return result.matchedCount > 0;
  });
}

export async function deleteCategoryRecord(id: string): Promise<boolean> {
  if (!/^[a-f\d]{24}$/i.test(id) || !isValidObjectId(id)) {
    return false;
  }
  return run(async () => {
    const category = await Category.findById(id).select("slug").lean<{ slug: string } | null>();
    if (!category) {
      return false;
    }
    const productCount = await Product.countDocuments({
      $or: [{ category: category.slug }, { collectionSlugs: category.slug }],
    });
    if (productCount > 0) {
      throw new CategoryInUseError(productCount);
    }
    const result = await Category.deleteOne({ _id: id });
    return result.deletedCount > 0;
  });
}

export async function assertCategoryAssignment(
  category: string,
  collectionSlugs: string[],
  status: "draft" | "active" | "archived",
  previousCategory?: string,
): Promise<string | null> {
  const count = await Category.countDocuments({});
  const legacy = new Set(["kani", "embroidered", "everyday"]);
  const slugs = [category, ...collectionSlugs];
  if (count === 0) {
    const unknown = slugs.find((slug) => !legacy.has(slug));
    return unknown ? "Create that category before assigning it. The original three are available until categories are seeded." : null;
  }
  const docs = await Category.find({ slug: { $in: slugs } }).select("slug active").lean<Array<{ slug: string; active: boolean }>>();
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc.active]));
  if (!bySlug.has(category)) {
    return "That category does not exist.";
  }
  if (status === "active" && bySlug.get(category) !== true && category !== previousCategory) {
    return "Choose an active category before publishing this shawl.";
  }
  for (const extra of collectionSlugs) {
    if (!bySlug.has(extra)) {
      return "One of the additional collections does not exist.";
    }
  }
  return null;
}
