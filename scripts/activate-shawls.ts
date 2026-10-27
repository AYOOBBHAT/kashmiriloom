/**
 * Makes imported shawl drafts publicly visible.
 * Dry-run is the default. Pass --apply to write. Only status and active are set.
 *
 * pnpm activate:shawls
 * pnpm activate:shawls -- --apply
 */
import { access, constants } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import {
  activationFields,
  EXPECTED_IMPORTED_SHAWLS,
  isInsideDirectory,
  planShawlActivation,
  publicImageFileKey,
  type ActivationProduct,
  type ActivationRow,
  type ShawlIdentity,
} from "@/lib/catalogue/activate-shawls";
import { discoverShawls, importSku, importSlug, matchShawlCategory } from "@/lib/catalogue/shawl-import";
import { SHAWL_SOURCES } from "@/lib/catalogue/shawl-sources";
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

function printRow(row: ActivationRow) {
  console.log(
    `${row.action}\t${row.name}\t${row.slug}\t${row.sku}\t${row.currentStatus}\timages=${row.imageCount}\tpricePaise=${row.pricePaise}\tstock=${row.stockQuantity}\tfeatured=${row.featured}`,
  );
  console.log(`  ${row.changes.length > 0 ? row.changes.join(", ") + ". " : ""}${row.reason}`);
}

async function existingFiles(publicDirectory: string, urls: string[]): Promise<Set<string>> {
  const root = path.resolve(publicDirectory);
  const found = new Set<string>();
  for (const url of urls) {
    const key = publicImageFileKey(url);
    if (!key) {
      continue;
    }
    const absolute = path.resolve(root, ...key.split("/"));
    if (!isInsideDirectory(root, absolute)) {
      continue;
    }
    try {
      await access(absolute, constants.R_OK);
      found.add(key);
    } catch {
      continue;
    }
  }
  return found;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const source = loadSeedEnv();
  const uri = process.env.MONGODB_URI?.trim() ?? "";
  if (!uri || source === "missing") {
    console.error("MONGODB_URI is not set. The value is not printed.");
    process.exitCode = 1;
    return;
  }
  const target = targetClass(uri);
  console.log(`Using MONGODB_URI from ${source}. The value is not printed.`);
  console.log(`Target class: ${target.kind}. Database name from the URI path: ${target.database}.`);
  console.log(apply ? "Apply mode. Matching drafts may be set to active. No other fields are written." : "Dry run. No products will be written.");

  mongoose.set("autoIndex", false);
  const { connectToDatabase, disconnectDatabase } = await import("@/lib/mongodb");
  const { Category } = await import("@/lib/models/category");
  const { Product } = await import("@/lib/models/product");
  await connectToDatabase();
  console.log(`Connected database name: ${mongoose.connection.name || "(unnamed)"}.`);

  try {
    const categories = await Category.find({})
      .select("slug name active")
      .limit(200)
      .lean<Array<{ slug: string; name: string; active: boolean }>>();
    const products = await Product.find({})
      .select("name slug sku status active featured category pricePaise stockQuantity images.url")
      .limit(5000)
      .lean<ActivationProduct[]>();
    const shawls = await discoverShawls(path.join(process.cwd(), "public"));
    const identities: ShawlIdentity[] = [];
    for (const shawl of shawls) {
      if (shawl.images.length === 0) {
        continue;
      }
      const definition = SHAWL_SOURCES.find((item) => item.directory === shawl.sourceDirectory);
      if (!definition) {
        console.error(`No source mapping for ${shawl.sourceDirectory}. Nothing was written.`);
        process.exitCode = 1;
        return;
      }
      const category = matchShawlCategory(definition, categories);
      if (category === "ambiguous" || !category) {
        console.error(`No single category matches ${shawl.sourceDirectory}. Nothing was written.`);
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
    if (identities.length !== EXPECTED_IMPORTED_SHAWLS) {
      console.error(`Expected ${EXPECTED_IMPORTED_SHAWLS} imported shawls and found ${identities.length}. Nothing was written.`);
      process.exitCode = 1;
      return;
    }
    const urls = products.flatMap((product) => product.images?.map((image) => image.url) ?? []);
    const files = await existingFiles(path.join(process.cwd(), "public"), urls);
    const plan = planShawlActivation({
      identities,
      products: products.map((product) => ({ ...product, images: product.images ?? [] })),
      categories,
      files,
    });
    if (!plan.ok) {
      console.error(plan.reason);
      process.exitCode = 1;
      return;
    }
    for (const row of plan.rows) {
      printRow(row);
    }
    const count = (action: ActivationRow["action"]) => plan.rows.filter((row) => row.action === action).length;
    console.log("");
    console.log(`Summary: ${count("activate")} to activate, ${count("already-active")} already active, ${count("blocked")} blocked.`);
    console.log("Featured stays unchanged, so these shawls appear in the shop and their collections, not in the homepage edit.");
    console.log("Price stays ₹5,000 and stock stays 1 on every product that passes.");
    if (!apply) {
      console.log("Dry run finished. No products were written.");
      return;
    }
    const ready = plan.rows.filter((row) => row.action === "activate");
    if (ready.length === 0) {
      console.log("No products needed activation.");
      return;
    }
    const fields = activationFields();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const row of ready) {
          const result = await Product.updateOne(
            { slug: row.slug, sku: row.sku },
            { $set: fields },
            { session },
          );
          if (result.matchedCount !== 1) {
            throw new Error(`Expected one product for ${row.slug}.`);
          }
        }
      });
    } finally {
      await session.endSession();
    }
    console.log(`Activated ${ready.length} shawls. Only status and active were written.`);
    console.log("The public catalogue cache refreshes on its own within about a minute. Saving a product or category in admin expires it immediately.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`Shawl activation failed: ${redactSecrets(detail)}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
