import "server-only";

import { open } from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag, io } from "next/cache";
import { cloudinaryInfoUrl } from "@/lib/catalogue/cloudinary-delivery";
import { sizeFromCloudinaryInfo, sizeFromImageBytes, type PhotoSize } from "@/lib/catalogue/image-dimensions";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue/public-tag";
import { isApprovedImageUrl } from "@/lib/products/images";

const HEADER_BYTES = 262144;

function localImageFile(src: string): string | null {
  if (!src.startsWith("/") || !isApprovedImageUrl(src)) {
    return null;
  }
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    return null;
  }
  if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("\0")) {
    return null;
  }
  const root = path.resolve(process.cwd(), "public");
  const file = path.resolve(root, decoded.slice(1));
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return file;
}

/** Pixel size of a catalogue photograph. Missing or unreadable files return null. */
async function readPhotoSize(src: string): Promise<PhotoSize | null> {
  try {
    const info = cloudinaryInfoUrl(src);
    if (info) {
      const response = await fetch(info, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) {
        return null;
      }
      return sizeFromCloudinaryInfo(await response.json());
    }
    const file = localImageFile(src);
    if (!file) {
      return null;
    }
    const handle = await open(file, "r");
    try {
      const buffer = Buffer.alloc(HEADER_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
      return sizeFromImageBytes(buffer.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

/** One cached lookup per photograph. Catalogue saves expire this with the public catalogue. */
export async function photoSizeFor(src: string): Promise<PhotoSize | null> {
  "use cache";
  cacheTag(PUBLIC_CATALOGUE_TAG);
  cacheLife("minutes");
  await io();
  return readPhotoSize(src);
}

export async function measureImages(sources: string[]): Promise<Array<PhotoSize | null>> {
  const unique = [...new Set(sources.filter((src) => src.length > 0))];
  const measured = new Map<string, PhotoSize | null>();
  let cursor = 0;
  async function run(): Promise<void> {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const src = unique[index];
      if (!src) {
        return;
      }
      measured.set(src, await photoSizeFor(src));
    }
  }
  const workers = Math.min(6, unique.length);
  if (workers > 0) {
    await Promise.all(Array.from({ length: workers }, () => run()));
  }
  return sources.map((src) => measured.get(src) ?? null);
}
