import "server-only";

import { createHash } from "node:crypto";
import {
  CATALOGUE_IMAGE_FOLDER,
  CATALOGUE_IMAGE_FORMATS,
  MAX_CATALOGUE_IMAGE_BYTES,
  type CatalogueUploadGrant,
} from "@/lib/catalogue/upload-grant";
import { isApprovedImageUrl } from "@/lib/products/images";

const MAX_BYTES = MAX_CATALOGUE_IMAGE_BYTES;

function hasImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }
  return (
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

export function cloudinaryConfigured(): boolean {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  const key = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
  const secret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
  return /^[a-z0-9_-]{1,64}$/i.test(cloud) && key.length > 0 && secret.length > 0;
}

export function catalogueUploadSignature(input: {
  folder: string;
  timestamp: number;
  allowedFormats: string;
  apiSecret: string;
}): string {
  return createHash("sha1")
    .update(
      `allowed_formats=${input.allowedFormats}&folder=${input.folder}&timestamp=${input.timestamp}${input.apiSecret}`,
    )
    .digest("hex");
}

export function issueCatalogueUploadGrant(now = Date.now()): CatalogueUploadGrant | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
  if (!/^[a-z0-9_-]{1,64}$/i.test(cloudName) || apiKey.length === 0 || apiSecret.length === 0) {
    return null;
  }
  const timestamp = Math.floor(now / 1000);
  return {
    cloudName,
    apiKey,
    timestamp,
    folder: CATALOGUE_IMAGE_FOLDER,
    allowedFormats: CATALOGUE_IMAGE_FORMATS,
    signature: catalogueUploadSignature({
      folder: CATALOGUE_IMAGE_FOLDER,
      timestamp,
      allowedFormats: CATALOGUE_IMAGE_FORMATS,
      apiSecret,
    }),
  };
}

export async function uploadCatalogueImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
  if (!cloudinaryConfigured()) {
    return {
      ok: false,
      message:
        "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server, or choose an existing photograph.",
    };
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return { ok: false, message: "Use an image of 4 MB or smaller." };
  }
  if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") {
    return { ok: false, message: "Use a JPEG, PNG, or WebP image." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageSignature(bytes, file.type)) {
    return { ok: false, message: "That file is not a JPEG, PNG, or WebP image." };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = CATALOGUE_IMAGE_FOLDER;
  const allowedFormats = CATALOGUE_IMAGE_FORMATS;
  const signature = catalogueUploadSignature({ folder, timestamp, allowedFormats, apiSecret });
  const body = new FormData();
  body.set("file", new File([bytes], "upload", { type: file.type }));
  body.set("api_key", apiKey);
  body.set("timestamp", String(timestamp));
  body.set("signature", signature);
  body.set("folder", folder);
  body.set("allowed_formats", allowedFormats);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    console.error(`Cloudinary upload failed with status ${response.status}.`);
    return { ok: false, message: "The image could not be uploaded." };
  }
  const payload: unknown = await response.json();
  const url =
    payload &&
    typeof payload === "object" &&
    "secure_url" in payload &&
    typeof payload.secure_url === "string"
      ? payload.secure_url
      : "";
  if (!isApprovedImageUrl(url)) {
    console.error("Cloudinary returned an image address that this catalogue will not store.");
    return { ok: false, message: "The image could not be uploaded." };
  }
  return { ok: true, url };
}
