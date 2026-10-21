import type { CollectionId } from "@/data/catalog";
import { isApprovedImageUrl } from "@/lib/products/images";
import { isPaise, MAX_PAISE } from "@/lib/money";

const categories: CollectionId[] = ["kani", "embroidered", "everyday"];

export type ProductDraft = {
  name: string;
  slug: string;
  description: string;
  category: CollectionId;
  pricePaise: number;
  compareAtPricePaise?: number;
  sku: string;
  stockQuantity: number;
  active: boolean;
  featured: boolean;
  images: { url: string; alt: string }[];
  material?: string;
  dimensions?: string;
  care?: string;
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
  category: unknown;
  priceRupees: unknown;
  compareAtRupees: unknown;
  sku: unknown;
  stockQuantity: unknown;
  active: unknown;
  featured: unknown;
  images: { url: unknown; alt: unknown }[];
  material: unknown;
  dimensions: unknown;
  care: unknown;
}): DraftResult {
  const errors: FieldErrors = {};
  const name = clean(input.name);
  const slug = clean(input.slug).toLowerCase();
  const description = clean(input.description);
  const category = clean(input.category);
  const priceRupees = clean(input.priceRupees);
  const compareAtRupees = clean(input.compareAtRupees);
  const sku = clean(input.sku).toUpperCase();
  const stockText = clean(input.stockQuantity);

  if (name.length < 1 || name.length > 120) {
    errors.name = "Enter a name of 120 characters or fewer.";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    errors.slug = "Use a lowercase slug such as dal-garden.";
  }
  if (description.length < 1 || description.length > 2000) {
    errors.description = "Enter a description of 2,000 characters or fewer.";
  }
  if (!categories.some((item) => item === category)) {
    errors.category = "Choose Kani, embroidered, or everyday.";
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

  const images: { url: string; alt: string }[] = [];
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
      images.push({ url, alt });
    }
  });

  const material = optionalText(clean(input.material), 200, "material", errors);
  const dimensions = optionalText(clean(input.dimensions), 200, "dimensions", errors);
  const care = optionalText(clean(input.care), 500, "care", errors);

  if (Object.keys(errors).length > 0 || pricePaise === null || !categories.some((item) => item === category)) {
    return { ok: false, errors, message: "Check the highlighted fields." };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description,
      category: category as CollectionId,
      pricePaise,
      ...(compareAtPricePaise !== undefined ? { compareAtPricePaise } : {}),
      sku,
      stockQuantity,
      active: input.active === true,
      featured: input.featured === true,
      images,
      ...(material ? { material } : {}),
      ...(dimensions ? { dimensions } : {}),
      ...(care ? { care } : {}),
    },
  };
}
