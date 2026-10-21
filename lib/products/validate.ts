import { isSlug } from "@/lib/catalogue/slug";
import { isApprovedImageUrl } from "@/lib/products/images";
import { withPrimaryImage } from "@/lib/products/gallery";
import { isProductStatus, type ProductStatus } from "@/lib/products/status";
import { isPaise, MAX_PAISE } from "@/lib/money";

export type ProductDraft = {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: string;
  collectionSlugs: string[];
  pricePaise: number;
  compareAtPricePaise?: number;
  sku: string;
  stockQuantity: number;
  status: ProductStatus;
  featured: boolean;
  images: { url: string; alt: string; primary: boolean }[];
  material?: string;
  dimensions?: string;
  care?: string;
  color?: string;
  weave?: string;
  embroidery?: string;
  size?: string;
  variantGroup?: string;
  variantLabel?: string;
  expectedUpdatedAt?: string;
  linkSourceId?: string;
};

export type FieldErrors = Record<string, string>;

export type DraftResult =
  | { ok: true; value: ProductDraft }
  | { ok: false; errors: FieldErrors; message: string };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseInrToPaise(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "").replace(/^₹/, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = "", fraction = ""] = trimmed.split(".");
  const rupees = Number(whole);
  const paisePart = Number(fraction.padEnd(2, "0") || "0");
  if (!Number.isInteger(rupees) || !Number.isInteger(paisePart) || paisePart > 99) {
    return null;
  }
  const paise = rupees * 100 + paisePart;
  if (!isPaise(paise) || paise > MAX_PAISE) {
    return null;
  }
  return paise;
}

export function paiseToRupeeInput(paise: number): string {
  if (!isPaise(paise)) {
    return "";
  }
  const rupees = Math.trunc(paise / 100);
  const remainder = paise % 100;
  if (remainder === 0) {
    return String(rupees);
  }
  return `${rupees}.${String(remainder).padStart(2, "0")}`;
}

function optionalText(value: string, max: number, field: string, errors: FieldErrors): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.length > max) {
    errors[field] = `Use ${max} characters or fewer.`;
    return undefined;
  }
  return value;
}

export function validateProductDraft(input: {
  name: unknown;
  slug: unknown;
  description: unknown;
  shortDescription: unknown;
  category: unknown;
  collectionSlugs: unknown[];
  priceRupees: unknown;
  compareAtRupees: unknown;
  sku: unknown;
  stockQuantity: unknown;
  status: unknown;
  featured: unknown;
  images: { url: unknown; alt: unknown; primary?: boolean }[];
  material: unknown;
  dimensions: unknown;
  care: unknown;
  color: unknown;
  weave: unknown;
  embroidery: unknown;
  size: unknown;
  variantGroup: unknown;
  variantLabel: unknown;
  expectedUpdatedAt: unknown;
  linkSourceId: unknown;
}): DraftResult {
  const errors: FieldErrors = {};
  const name = clean(input.name);
  const slug = clean(input.slug).toLowerCase();
  const description = clean(input.description);
  const category = clean(input.category).toLowerCase();
  const priceRupees = clean(input.priceRupees);
  const compareAtRupees = clean(input.compareAtRupees);
  const sku = clean(input.sku).toUpperCase();
  const stockText = clean(input.stockQuantity);
  const statusText = clean(input.status);
  const variantGroup = clean(input.variantGroup).toLowerCase();
  const expectedUpdatedAt = clean(input.expectedUpdatedAt);
  const linkSourceId = clean(input.linkSourceId);

  if (name.length < 1 || name.length > 120) {
    errors.name = "Enter a name of 120 characters or fewer.";
  }
  if (!isSlug(slug)) {
    errors.slug = "Use a lowercase slug such as dal-garden.";
  }
  if (description.length < 1 || description.length > 2000) {
    errors.description = "Enter a description of 2,000 characters or fewer.";
  }
  if (!isSlug(category)) {
    errors.category = "Choose a category.";
  }
  const pricePaise = parseInrToPaise(priceRupees);
  if (pricePaise === null) {
    errors.priceRupees = "Enter a price in rupees, with at most two decimal places.";
  }
  let compareAtPricePaise: number | undefined;
  if (compareAtRupees) {
    const parsed = parseInrToPaise(compareAtRupees);
    if (parsed === null) {
      errors.compareAtRupees = "Enter a compare-at price in rupees, or leave it blank.";
    } else if (pricePaise !== null && parsed <= pricePaise) {
      errors.compareAtRupees = "The compare-at price must be higher than the selling price.";
    } else {
      compareAtPricePaise = parsed;
    }
  }
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(sku) || sku.length > 40) {
    errors.sku = "Use a SKU such as KL-SAMPLE-NISHAT.";
  }
  if (!/^\d{1,6}$/.test(stockText)) {
    errors.stockQuantity = "Enter a whole number from 0 to 100000.";
  }
  const stockQuantity = Number(stockText);
  if (Number.isInteger(stockQuantity) && stockQuantity > 100_000) {
    errors.stockQuantity = "Enter a whole number from 0 to 100000.";
  }
  if (!isProductStatus(statusText)) {
    errors.status = "Choose draft, active, or archived.";
  }

  const collectionSlugs: string[] = [];
  const seenCollections = new Set<string>();
  for (const entry of input.collectionSlugs) {
    const value = clean(entry).toLowerCase();
    if (!value || seenCollections.has(value)) {
      continue;
    }
    seenCollections.add(value);
    if (!isSlug(value) || value === category) {
      errors.collectionSlugs = "Additional collections must be other categories.";
      continue;
    }
    collectionSlugs.push(value);
  }
  if (collectionSlugs.length > 6) {
    errors.collectionSlugs = "Choose up to 6 additional collections.";
  }

  const images: { url: string; alt: string; primary: boolean }[] = [];
  if (input.images.length < 1 || input.images.length > 6) {
    errors.images = "Add between 1 and 6 images.";
  }
  input.images.forEach((image, index) => {
    const url = clean(image.url);
    const alt = clean(image.alt);
    if (!isApprovedImageUrl(url)) {
      errors[`image-${index}-url`] =
        "Use an existing catalogue photograph or an image uploaded to this house's Cloudinary account.";
    }
    if (alt.length < 1 || alt.length > 300) {
      errors[`image-${index}-alt`] = "Describe the image in 300 characters or fewer.";
    }
    if (url && alt && isApprovedImageUrl(url) && alt.length <= 300) {
      images.push({ url, alt, primary: image.primary === true });
    }
  });

  const shortDescription = optionalText(clean(input.shortDescription), 280, "shortDescription", errors);
  const material = optionalText(clean(input.material), 200, "material", errors);
  const dimensions = optionalText(clean(input.dimensions), 200, "dimensions", errors);
  const care = optionalText(clean(input.care), 500, "care", errors);
  const color = optionalText(clean(input.color), 80, "color", errors);
  const weave = optionalText(clean(input.weave), 80, "weave", errors);
  const embroidery = optionalText(clean(input.embroidery), 80, "embroidery", errors);
  const size = optionalText(clean(input.size), 80, "size", errors);
  const variantLabel = optionalText(clean(input.variantLabel), 80, "variantLabel", errors);
  let group: string | undefined;
  if (variantGroup) {
    if (!isSlug(variantGroup)) {
      errors.variantGroup = "Use a lowercase variant group such as dal-garden.";
    } else {
      group = variantGroup;
    }
  }
  if (linkSourceId && !/^[a-f\d]{24}$/i.test(linkSourceId)) {
    errors.linkSourceId = "That related shawl could not be linked.";
  }

  if (Object.keys(errors).length > 0 || pricePaise === null || !isProductStatus(statusText)) {
    return { ok: false, errors, message: "Check the highlighted fields." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description,
      category,
      collectionSlugs,
      pricePaise,
      ...(compareAtPricePaise !== undefined ? { compareAtPricePaise } : {}),
      sku,
      stockQuantity,
      status: statusText,
      featured: input.featured === true && statusText === "active",
      images: withPrimaryImage(images),
      ...(shortDescription ? { shortDescription } : {}),
      ...(material ? { material } : {}),
      ...(dimensions ? { dimensions } : {}),
      ...(care ? { care } : {}),
      ...(color ? { color } : {}),
      ...(weave ? { weave } : {}),
      ...(embroidery ? { embroidery } : {}),
      ...(size ? { size } : {}),
      ...(group ? { variantGroup: group } : {}),
      ...(variantLabel ? { variantLabel } : {}),
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
      ...(linkSourceId ? { linkSourceId } : {}),
    },
  };
}
