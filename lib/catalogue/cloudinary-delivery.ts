const HOST = "res.cloudinary.com";

/** Stored public id for one imported shawl photograph. The same id is reused on every run. */
export function shawlPublicId(slug: string, index: number): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error("Shawl slug cannot be used as a Cloudinary id.");
  }
  if (!Number.isInteger(index) || index < 0 || index > 99) {
    throw new Error("Shawl image index is out of range.");
  }
  return `kashmiriloom/shawls/${slug}/${String(index + 1).padStart(2, "0")}`;
}

export function shawlDeliveryUrl(cloudName: string, slug: string, index: number): string {
  if (!/^[a-z0-9_-]{1,64}$/i.test(cloudName)) {
    throw new Error("Cloudinary cloud name is not valid.");
  }
  return `https://${HOST}/${cloudName}/image/upload/${shawlPublicId(slug, index)}`;
}

/**
 * Browser URL for an already stored Cloudinary upload.
 * Format and quality are chosen by Cloudinary. Width follows the slot passed by next/image.
 */
export function cloudinaryTransformedUrl(src: string, width: number): string | null {
  if (!Number.isInteger(width) || width < 1 || width > 3840) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== HOST ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    return null;
  }
  const parts = parsed.pathname.split("/").filter((part) => part.length > 0);
  const cloud = parts[0] ?? "";
  if (!/^[a-z0-9_-]{1,64}$/i.test(cloud) || parts[1] !== "image" || parts[2] !== "upload") {
    return null;
  }
  const rest = parts.slice(3);
  if (
    rest.length === 0 ||
    rest.some((part) => part === "." || part === ".." || !/^[a-z0-9_.-]+$/i.test(part))
  ) {
    return null;
  }
  const transform = `f_auto,q_auto:good,c_limit,w_${width}`;
  return `https://${HOST}/${cloud}/image/upload/${transform}/${rest.join("/")}`;
}

export function isCloudinaryUploadUrl(src: string): boolean {
  return cloudinaryTransformedUrl(src, 640) !== null;
}

export function cloudinaryImageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const delivery = cloudinaryTransformedUrl(src, width);
  if (!delivery) {
    throw new Error("This image address cannot be delivered.");
  }
  return delivery;
}
