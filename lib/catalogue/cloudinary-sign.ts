import { createHash } from "node:crypto";

/** Signed upload parameters, excluding the file and the API key. */
export function cloudinaryUploadSignature(params: Record<string, string>, apiSecret: string): string {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${apiSecret}`).digest("hex");
}
