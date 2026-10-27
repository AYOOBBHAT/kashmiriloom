import { isProductStatus, type ProductStatus } from "@/lib/products/status";

export type SaveKind = "created" | "updated";

export const PRODUCT_SAVE_FAILED = "The product could not be saved. Nothing was changed. Try again.";
export const CATEGORY_SAVE_FAILED = "The category could not be saved. Nothing was changed. Try again.";

export function saveKind(value: string | undefined): SaveKind | null {
  return value === "created" || value === "updated" ? value : null;
}

export type EnteredCategory = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  active: boolean;
  displayOrder: string;
  expectedUpdatedAt: string;
};

export type EnteredProduct = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  collectionSlugs: string[];
  priceRupees: string;
  compareAtRupees: string;
  sku: string;
  stockQuantity: string;
  status: ProductStatus;
  featured: boolean;
  material: string;
  dimensions: string;
  care: string;
  color: string;
  weave: string;
  embroidery: string;
  size: string;
  variantGroup: string;
  variantLabel: string;
  expectedUpdatedAt: string;
  linkSourceId: string;
};

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function categoryEntered(formData: FormData): EnteredCategory {
  return {
    name: text(formData.get("name")),
    slug: text(formData.get("slug")),
    description: text(formData.get("description")),
    imageUrl: text(formData.get("imageUrl")),
    imageAlt: text(formData.get("imageAlt")),
    active: formData.get("active") === "on",
    displayOrder: text(formData.get("displayOrder")),
    expectedUpdatedAt: text(formData.get("expectedUpdatedAt")),
  };
}

export function productEntered(formData: FormData): EnteredProduct {
  const statusText = text(formData.get("status"));
  return {
    name: text(formData.get("name")),
    slug: text(formData.get("slug")),
    description: text(formData.get("description")),
    shortDescription: text(formData.get("shortDescription")),
    category: text(formData.get("category")),
    collectionSlugs: formData.getAll("collectionSlug").flatMap((entry) => (typeof entry === "string" && entry ? [entry] : [])),
    priceRupees: text(formData.get("priceRupees")),
    compareAtRupees: text(formData.get("compareAtRupees")),
    sku: text(formData.get("sku")),
    stockQuantity: text(formData.get("stockQuantity")),
    status: isProductStatus(statusText) ? statusText : "draft",
    featured: formData.get("featured") === "on",
    material: text(formData.get("material")),
    dimensions: text(formData.get("dimensions")),
    care: text(formData.get("care")),
    color: text(formData.get("color")),
    weave: text(formData.get("weave")),
    embroidery: text(formData.get("embroidery")),
    size: text(formData.get("size")),
    variantGroup: text(formData.get("variantGroup")),
    variantLabel: text(formData.get("variantLabel")),
    expectedUpdatedAt: text(formData.get("expectedUpdatedAt")),
    linkSourceId: text(formData.get("linkSourceId")),
  };
}

export function failedCategory(
  previous: { attempt?: number },
  formData: FormData,
  message: string,
  errors: Record<string, string>,
) {
  return {
    message,
    errors,
    entered: categoryEntered(formData),
    attempt: (previous.attempt ?? 0) + 1,
  };
}

export function failedProduct(
  previous: { attempt?: number },
  formData: FormData,
  message: string,
  errors: Record<string, string>,
) {
  return {
    message,
    errors,
    entered: productEntered(formData),
    attempt: (previous.attempt ?? 0) + 1,
  };
}
