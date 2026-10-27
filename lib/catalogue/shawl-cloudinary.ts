import { EXPECTED_IMPORTED_SHAWLS, publicImageFileKey } from "@/lib/catalogue/activate-shawls";
import { shawlDeliveryUrl, shawlPublicId } from "@/lib/catalogue/cloudinary-delivery";
import { withPrimaryImage } from "@/lib/products/gallery";
import { MAX_PRODUCT_IMAGES } from "@/lib/products/limits";

export type CloudinaryStoredImage = {
  url: string;
  alt: string;
  primary?: boolean;
};

export type CloudinaryProduct = {
  name: string;
  slug: string;
  sku: string;
  images: CloudinaryStoredImage[];
};

export type CloudinaryIdentity = {
  source: string;
  folderName: string;
  slug: string;
  sku: string;
};

export type PlannedCloudinaryImage = {
  index: number;
  alt: string;
  primary: boolean;
  publicId: string;
  deliveryUrl: string;
  localKey: string | null;
  bytes: number;
};

export type CloudinaryMigrationAction = "migrate" | "already-migrated" | "blocked";

export type CloudinaryMigrationRow = {
  name: string;
  source: string;
  slug: string;
  sku: string;
  action: CloudinaryMigrationAction;
  reason: string;
  bytes: number;
  images: PlannedCloudinaryImage[];
};

export function cloudinaryImagePatch(
  row: CloudinaryMigrationRow,
): { images: Array<{ url: string; alt: string; primary: boolean }> } | null {
  if (row.action !== "migrate") {
    return null;
  }
  return {
    images: row.images.map((image) => ({
      url: image.deliveryUrl,
      alt: image.alt,
      primary: image.primary,
    })),
  };
}

function sameIdentity(left: CloudinaryIdentity, right: CloudinaryIdentity): boolean {
  return left.slug === right.slug && left.sku === right.sku;
}

export function planShawlCloudinaryMigration(input: {
  identities: CloudinaryIdentity[];
  products: CloudinaryProduct[];
  cloudName: string;
  fileBytes: ReadonlyMap<string, number>;
  expectedCount?: number;
}): { ok: true; rows: CloudinaryMigrationRow[] } | { ok: false; reason: string } {
  const expectedCount = input.expectedCount ?? EXPECTED_IMPORTED_SHAWLS;
  if (!/^[a-z0-9_-]{1,64}$/i.test(input.cloudName)) {
    return { ok: false, reason: "Cloudinary cloud name is not configured." };
  }
  if (input.identities.length !== expectedCount) {
    return { ok: false, reason: `Expected ${expectedCount} imported shawls and found ${input.identities.length}.` };
  }
  const seen = new Set<string>();
  for (const identity of input.identities) {
    const key = `${identity.slug}\n${identity.sku}`;
    if (seen.has(key) || input.identities.some((other) => other !== identity && sameIdentity(other, identity))) {
      return { ok: false, reason: `Duplicate imported identity ${identity.slug}.` };
    }
    seen.add(key);
    const bySlug = input.products.filter((product) => product.slug === identity.slug);
    const bySku = input.products.filter((product) => product.sku === identity.sku);
    if (bySlug.some((product) => product.sku !== identity.sku) || bySku.some((product) => product.slug !== identity.slug)) {
      return { ok: false, reason: `Slug and SKU do not belong to the same product for ${identity.slug}.` };
    }
    if (bySlug.filter((product) => product.sku === identity.sku).length !== 1) {
      return { ok: false, reason: `No single product matches ${identity.slug} and ${identity.sku}.` };
    }
  }

  const rows: CloudinaryMigrationRow[] = [];
  for (const identity of input.identities) {
    const product = input.products.find((item) => item.slug === identity.slug && item.sku === identity.sku);
    if (!product) {
      return { ok: false, reason: `No single product matches ${identity.slug} and ${identity.sku}.` };
    }
    rows.push(planProduct(identity, product, input.cloudName, input.fileBytes));
  }
  return { ok: true, rows };
}

function planProduct(
  identity: CloudinaryIdentity,
  product: CloudinaryProduct,
  cloudName: string,
  fileBytes: ReadonlyMap<string, number>,
): CloudinaryMigrationRow {
  const base = {
    name: product.name,
    source: identity.source,
    slug: identity.slug,
    sku: identity.sku,
  };
  if (product.images.length === 0 || product.images.length > MAX_PRODUCT_IMAGES) {
    return { ...base, action: "blocked", reason: "The product does not have an allowed gallery size.", bytes: 0, images: [] };
  }
  const ordered = withPrimaryImage(product.images);
  const images: PlannedCloudinaryImage[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const image = ordered[index];
    if (!image) {
      return { ...base, action: "blocked", reason: "A gallery entry is missing.", bytes: 0, images: [] };
    }
    const publicId = shawlPublicId(identity.slug, index);
    const deliveryUrl = shawlDeliveryUrl(cloudName, identity.slug, index);
    if (deliveryUrl.length > 500) {
      return { ...base, action: "blocked", reason: "The Cloudinary address is longer than the catalogue allows.", bytes: 0, images: [] };
    }
    const alt = image.alt.trim().slice(0, 300);
    if (image.url === deliveryUrl) {
      images.push({ index, alt, primary: image.primary === true, publicId, deliveryUrl, localKey: null, bytes: 0 });
      continue;
    }
    const localKey = publicImageFileKey(image.url);
    if (!localKey) {
      return {
        ...base,
        action: "blocked",
        reason: "A gallery image is not a local imported shawl file or the expected Cloudinary address.",
        bytes: 0,
        images: [],
      };
    }
    const bytes = fileBytes.get(localKey);
    if (bytes == null || bytes <= 0) {
      return { ...base, action: "blocked", reason: `The local file for image ${index + 1} is missing.`, bytes: 0, images: [] };
    }
    images.push({ index, alt, primary: image.primary === true, publicId, deliveryUrl, localKey, bytes });
  }
  const bytes = images.reduce((sum, image) => sum + image.bytes, 0);
  if (images.every((image) => image.localKey === null)) {
    return { ...base, action: "already-migrated", reason: "Every gallery URL already uses this shawl's Cloudinary id.", bytes: 0, images };
  }
  return { ...base, action: "migrate", reason: "Upload the local gallery, then replace only its URL array.", bytes, images };
}
