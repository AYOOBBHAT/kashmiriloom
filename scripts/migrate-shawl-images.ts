/**
 * Moves imported shawl galleries from public files to Cloudinary.
 * Dry-run is the default. Pass --apply to upload and then replace image URLs.
 * Local files are left in place.
 *
 * pnpm migrate:shawl-images
 * pnpm migrate:shawl-images -- --apply
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { publicImageFileKey } from "@/lib/catalogue/activate-shawls";
import { cloudinaryTransformedUrl } from "@/lib/catalogue/cloudinary-delivery";
import { cloudinaryUploadSignature } from "@/lib/catalogue/cloudinary-sign";
import { summarizeCloudinaryUsage, type CloudinaryUsageSummary } from "@/lib/catalogue/cloudinary-usage";
import { discoverShawls, importSku, importSlug, matchShawlCategory } from "@/lib/catalogue/shawl-import";
import { SHAWL_SOURCES } from "@/lib/catalogue/shawl-sources";
import {
  cloudinaryImagePatch,
  planShawlCloudinaryMigration,
  type CloudinaryIdentity,
  type CloudinaryMigrationRow,
  type CloudinaryProduct,
} from "@/lib/catalogue/shawl-cloudinary";
import { redactSecrets } from "@/lib/catalogue-error";
import { loadSeedEnv } from "./load-env";

function targetClass(uri: string): { kind: string; database: string } {
  const normalized = uri.replace(/^mongodb\+srv:\/\//i, "https://").replace(/^mongodb:\/\//i, "http://");
  const parsed = new URL(normalized);
  const host = parsed.hostname;
  const named = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] ?? "");
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return { kind: local ? "local" : host.endsWith(".mongodb.net") ? "atlas" : "remote", database: named || "kashmiriloom" };
}

function mebibytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function printUsage(summary: CloudinaryUsageSummary) {
  console.log(`Cloudinary plan: ${summary.plan ?? "not reported"}.`);
  console.log(
    `Storage used ${summary.storageUsed ?? "unknown"} of ${summary.storageLimit ?? "unknown"} bytes. Transformations used ${summary.transformationsUsed ?? "unknown"} of ${summary.transformationsLimit ?? "unknown"}. Bandwidth used ${summary.bandwidthUsed ?? "unknown"} of ${summary.bandwidthLimit ?? "unknown"} bytes. Credits used ${summary.creditsUsed ?? "unknown"} of ${summary.creditsLimit ?? "unknown"}. Objects used ${summary.objectsUsed ?? "unknown"} of ${summary.objectsLimit ?? "unknown"}.`,
  );
}

async function readUsage(cloudName: string, apiKey: string, apiSecret: string): Promise<CloudinaryUsageSummary | null> {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    console.error(`Cloudinary usage could not be verified. The request finished with status ${response.status}.`);
    return null;
  }
  const summary = summarizeCloudinaryUsage(await response.json());
  if (!summary) {
    console.error("Cloudinary usage could not be verified. The response did not include usage counts.");
    return null;
  }
  return summary;
}

async function fileBytes(publicDirectory: string, urls: string[]): Promise<Map<string, number>> {
  const root = path.resolve(publicDirectory);
  const sizes = new Map<string, number>();
  for (const url of urls) {
    const key = publicImageFileKey(url);
    if (!key || sizes.has(key)) {
      continue;
    }
    const absolute = path.resolve(root, ...key.split("/"));
    const relative = path.relative(root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      continue;
    }
    try {
      const info = await stat(absolute);
      if (info.isFile() && info.size > 0) {
        sizes.set(key, info.size);
      }
    } catch {
      continue;
    }
  }
  return sizes;
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  return "image/png";
}

async function uploadImage(input: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  publicId: string;
  filePath: string;
}): Promise<boolean> {
  const bytes = await readFile(input.filePath);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = {
    allowed_formats: "jpg,png,webp",
    invalidate: "true",
    overwrite: "true",
    public_id: input.publicId,
    timestamp,
  };
  const body = new FormData();
  body.set("file", new Blob([bytes], { type: contentType(input.filePath) }));
  body.set("api_key", input.apiKey);
  body.set("timestamp", timestamp);
  body.set("signature", cloudinaryUploadSignature(params, input.apiSecret));
  body.set("allowed_formats", params.allowed_formats);
  body.set("invalidate", params.invalidate);
  body.set("overwrite", params.overwrite);
  body.set("public_id", params.public_id);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${input.cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    console.error(`Cloudinary upload failed with status ${response.status}.`);
    return false;
  }
  const payload: unknown = await response.json();
  const publicId =
    payload && typeof payload === "object" && "public_id" in payload && typeof payload.public_id === "string"
      ? payload.public_id
      : "";
  return publicId === input.publicId;
}

async function delivered(url: string): Promise<boolean> {
  const transformed = cloudinaryTransformedUrl(url, 320);
  const targets = transformed ? [url, transformed] : [url];
  for (const target of targets) {
    const response = await fetch(target, { method: "GET", headers: { Accept: "image/avif,image/webp,image/*" } });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) {
      await response.arrayBuffer().catch(() => undefined);
      return false;
    }
    await response.arrayBuffer();
  }
  return true;
}

function printRow(row: CloudinaryMigrationRow) {
  const pending = row.images.filter((image) => image.localKey !== null).length;
  console.log(`${row.action}\t${row.slug}\t${row.sku}\timages=${row.images.length}\tpending=${pending}\t${mebibytes(row.bytes)}`);
  console.log(`  ${row.reason}`);
  for (const image of row.images) {
    console.log(`  ${image.publicId}\t${image.localKey ?? "already stored"}`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const source = loadSeedEnv();
  const uri = process.env.MONGODB_URI?.trim() ?? "";
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
  if (!uri || source === "missing") {
    console.error("MONGODB_URI is not set. The value is not printed.");
    process.exitCode = 1;
    return;
  }
  const target = targetClass(uri);
  console.log(`Using MONGODB_URI from ${source}. The value is not printed.`);
  console.log(`Target class: ${target.kind}. Database name from the URI path: ${target.database}.`);
  console.log(apply ? "Apply mode. Image URL arrays may be replaced after each gallery uploads." : "Dry run. No uploads and no product writes.");

  mongoose.set("autoIndex", false);
  const { connectToDatabase, disconnectDatabase } = await import("@/lib/mongodb");
  const { Category } = await import("@/lib/models/category");
  const { Product } = await import("@/lib/models/product");
  await connectToDatabase();
  console.log(`Connected database name: ${mongoose.connection.name || "(unnamed)"}.`);

  try {
    const categories = await Category.find({}).select("slug name").limit(200).lean<Array<{ slug: string; name: string }>>();
    const products = await Product.find({})
      .select("name slug sku images.url images.alt images.primary")
      .limit(5000)
      .lean<CloudinaryProduct[]>();
    const publicDirectory = path.join(process.cwd(), "public");
    const shawls = await discoverShawls(publicDirectory);
    const identities: CloudinaryIdentity[] = [];
    for (const shawl of shawls) {
      if (shawl.images.length === 0) {
        continue;
      }
      const definition = SHAWL_SOURCES.find((item) => item.directory === shawl.sourceDirectory);
      if (!definition) {
        console.error(`No source mapping for ${shawl.sourceDirectory}. Nothing was uploaded.`);
        process.exitCode = 1;
        return;
      }
      const category = matchShawlCategory(definition, categories);
      if (category === "ambiguous" || !category) {
        console.error(`No single category matches ${shawl.sourceDirectory}. Nothing was uploaded.`);
        process.exitCode = 1;
        return;
      }
      identities.push({
        source: shawl.sourceDirectory,
        folderName: shawl.folderName,
        slug: importSlug(category.slug, shawl.folderName),
        sku: importSku(category.slug, shawl.folderName),
      });
    }
    const folderImages = shawls.reduce((sum, shawl) => sum + shawl.images.length, 0);
    console.log(`Imported shawl folders with photographs: ${identities.length}. Files in those folders: ${folderImages}.`);
    const urls = products.flatMap((product) => product.images?.map((image) => image.url) ?? []);
    const sizes = await fileBytes(publicDirectory, urls);
    const plan = planShawlCloudinaryMigration({
      identities,
      products: products.map((product) => ({ ...product, images: product.images ?? [] })),
      cloudName,
      fileBytes: sizes,
    });
    if (!plan.ok) {
      console.error(plan.reason);
      process.exitCode = 1;
      return;
    }
    for (const row of plan.rows) {
      printRow(row);
    }
    const count = (action: CloudinaryMigrationRow["action"]) => plan.rows.filter((row) => row.action === action).length;
    const uploadBytes = plan.rows.reduce((sum, row) => sum + row.bytes, 0);
    const uploadImages = plan.rows.reduce((sum, row) => sum + row.images.filter((image) => image.localKey !== null).length, 0);
    console.log("");
    console.log(
      `Summary: ${count("migrate")} to migrate, ${count("already-migrated")} already migrated, ${count("blocked")} blocked. ${uploadImages} photographs, ${mebibytes(uploadBytes)}.`,
    );
    console.log("Retries reuse the same Cloudinary public id and overwrite that asset. Local public files are not deleted.");
    console.log("Only an image URL array is written, and only after every image in that product has uploaded and both the stored URL and a 320px delivery URL return an image.");
    let usage: CloudinaryUsageSummary | null = null;
    if (!/^[a-z0-9_-]{1,64}$/i.test(cloudName) || apiKey.length === 0 || apiSecret.length === 0) {
      console.error("Cloudinary usage could not be verified. The cloud name, API key, or API secret is not configured. Values are not printed.");
    } else {
      try {
        usage = await readUsage(cloudName, apiKey, apiSecret);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        console.error(`Cloudinary usage could not be verified. ${redactSecrets(detail)}`);
      }
    }
    if (usage) {
      printUsage(usage);
      if (usage.storageLimit != null && usage.storageUsed != null) {
        const remaining = usage.storageLimit - usage.storageUsed;
        console.log(`Storage remaining before this upload: ${mebibytes(Math.max(0, remaining))}. This batch is ${mebibytes(uploadBytes)}.`);
      }
    }
    if (!apply) {
      console.log("Dry run finished. No images were uploaded and no products were written.");
      return;
    }
    if (!usage) {
      console.error("Apply stopped because Cloudinary usage could not be verified. Nothing was uploaded.");
      process.exitCode = 1;
      return;
    }
    const ready = plan.rows.filter((row) => row.action === "migrate");
    let migrated = 0;
    let failed = 0;
    for (const row of ready) {
      const patch = cloudinaryImagePatch(row);
      if (!patch) {
        failed += 1;
        continue;
      }
      let uploaded = true;
      for (const image of row.images) {
        if (!image.localKey) {
          continue;
        }
        const absolute = path.resolve(publicDirectory, ...image.localKey.split("/"));
        const ok = await uploadImage({
          cloudName,
          apiKey,
          apiSecret,
          publicId: image.publicId,
          filePath: absolute,
        });
        if (!ok) {
          uploaded = false;
          console.error(`Upload did not finish for ${row.slug}. Its database record was not changed.`);
          break;
        }
      }
      if (!uploaded) {
        failed += 1;
        continue;
      }
      let verified = true;
      for (const image of row.images) {
        if (!(await delivered(image.deliveryUrl))) {
          verified = false;
          console.error(`Delivery was not verified for ${row.slug}. Its database record was not changed.`);
          break;
        }
      }
      if (!verified) {
        failed += 1;
        continue;
      }
      const result = await Product.updateOne({ slug: row.slug, sku: row.sku }, { $set: { images: patch.images } });
      if (result.matchedCount !== 1) {
        failed += 1;
        console.error(`The image update did not match one product for ${row.slug}.`);
        continue;
      }
      migrated += 1;
      console.log(`Updated image URLs for ${row.slug}.`);
    }
    console.log(`Finished. ${migrated} products updated, ${failed} left unchanged.`);
    console.log("Local files were left in place. After this write, deploy the site and save any catalogue record in admin so the public cache drops the old image URLs.");
    if (failed > 0 || count("blocked") > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`Shawl image migration failed: ${redactSecrets(detail)}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
