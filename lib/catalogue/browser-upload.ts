import {
  MAX_CATALOGUE_IMAGE_BYTES,
  type CatalogueUploadGrant,
} from "@/lib/catalogue/upload-grant";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function postCatalogueImage(
  file: File,
  grant: CatalogueUploadGrant,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!/^[a-z0-9_-]{1,64}$/i.test(grant.cloudName)) {
    return { ok: false, message: "The image could not be uploaded." };
  }
  if (file.size <= 0 || file.size > MAX_CATALOGUE_IMAGE_BYTES) {
    return { ok: false, message: "Use an image of 4 MB or smaller." };
  }
  if (!IMAGE_TYPES.has(file.type)) {
    return { ok: false, message: "Use a JPEG, PNG, or WebP image." };
  }

  const body = new FormData();
  body.set("file", file);
  body.set("api_key", grant.apiKey);
  body.set("timestamp", String(grant.timestamp));
  body.set("signature", grant.signature);
  body.set("folder", grant.folder);
  body.set("allowed_formats", grant.allowedFormats);

  let response: Response;
  try {
    response = await fetchImpl(`https://api.cloudinary.com/v1_1/${grant.cloudName}/image/upload`, {
      method: "POST",
      body,
    });
  } catch {
    return { ok: false, message: "The image could not be uploaded." };
  }
  if (!response.ok) {
    return { ok: false, message: "The image could not be uploaded." };
  }

  const payload: unknown = await response.json();
  const url =
    payload && typeof payload === "object" && "secure_url" in payload && typeof payload.secure_url === "string"
      ? payload.secure_url
      : "";
  const prefix = `https://res.cloudinary.com/${grant.cloudName}/image/upload/`;
  if (!url.startsWith(prefix) || url.length > 500 || /[\s\\]/.test(url)) {
    return { ok: false, message: "The image could not be uploaded." };
  }
  return { ok: true, url };
}
