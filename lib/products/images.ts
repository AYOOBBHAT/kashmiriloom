import { collections } from "@/data/catalog";
import { SHAWL_IMAGE_EXTENSIONS, SHAWL_SOURCES } from "@/lib/catalogue/shawl-sources";

export const LOCAL_IMAGES = new Set<string>([
  "/images/shawl-nishat.jpg",
  "/images/shawl-dal.jpg",
  "/images/shawl-chinar.jpg",
  "/images/shawl-zabarwan.jpg",
  "/images/shawl-gulab.jpg",
  "/images/shawl-sheen.jpg",
  "/images/collection-kani.jpg",
  "/images/collection-embroidered.jpg",
  "/images/collection-everyday.jpg",
  "/images/hero-shawl.jpg",
  "/images/craft-loom.jpg",
]);

export function publicImage(
  url: string,
  alt: string,
  category: string,
): { src: string; alt: string } {
  const collection = collections.find((item) => item.id === category);
  const fallback = collection
    ? { src: collection.image, alt: collection.imageAlt }
    : {
        src: "/images/collection-kani.jpg",
        alt: "Close view of a burgundy shawl covered in gold and forest-green paisley weaving.",
      };
  if (isApprovedImageUrl(url)) {
    const text = alt.trim();
    return { src: url, alt: text || fallback.alt };
  }
  return fallback;
}

export function cloudinaryCloudName(): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  if (!/^[a-z0-9_-]{1,64}$/i.test(cloud)) {
    return null;
  }
  return cloud;
}

/** Local catalogue files, an imported shawl photograph under public, or this house's Cloudinary cloud. */
export function isApprovedImageUrl(url: string): boolean {
  if (LOCAL_IMAGES.has(url) || isImportedShawlImage(url)) {
    return true;
  }
  const cloud = cloudinaryCloudName();
  if (!cloud) {
    return false;
  }
  const prefix = `https://res.cloudinary.com/${cloud}/image/upload/`;
  return url.startsWith(prefix) && url.length <= 500 && !/[\s\\]/.test(url);
}

export function isImportedShawlImage(url: string): boolean {
  if (!url.startsWith("/") || url.length > 500 || url.includes("\\") || url.includes("..")) {
    return false;
  }
  if (/[\u0000-\u001f]/.test(url)) {
    return false;
  }
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return false;
  }
  if (decoded.includes("\\") || decoded.includes("?") || decoded.includes("#") || /[\u0000-\u001f]/.test(decoded)) {
    return false;
  }
  const segments = decoded.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index] ?? "";
    if (segment.length === 0 || segment === "." || segment === "..") {
      return false;
    }
  }
  const extension = decoded.slice(decoded.lastIndexOf(".")).toLowerCase();
  if (!SHAWL_IMAGE_EXTENSIONS.some((item) => item === extension)) {
    return false;
  }
  return SHAWL_SOURCES.some((source) => decoded.startsWith(`/${source.directory}/`));
}
