/**
 * Imports one draft product for each shawl folder under public.
 * Dry-run is the default. Pass --apply to write. Nothing is deleted.
 *
 * pnpm import:shawls
 * pnpm import:shawls -- --apply
 * pnpm import:shawls -- --apply --update
 *
 * --update replaces the image array only when the slug and SKU both match the
 * import identity. It does not change name, description, price, stock, or publication status.
 */
import mongoose from "mongoose";
import path from "node:path";
import { discoverShawls, importerImagePatch, planShawlImport, type ImportPlanRow } from "@/lib/catalogue/shawl-import";
import { SHAWL_SOURCES } from "@/lib/catalogue/shawl-sources";
import { seedCategories } from "@/lib/categories/defaults";
import { redactSecrets } from "@/lib/catalogue-error";
import { validateProductDraft } from "@/lib/products/validate";
import { loadSeedEnv } from "./load-env";

function printRow(row: ImportPlanRow) {
  const identity = row.draft ? ` ${row.draft.slug} ${row.draft.sku} ₹${row.draft.pricePaise / 100}` : "";
  console.log(`${row.action}\t${row.source}${identity}`);
  console.log(`  ${row.reason}`);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const update = process.argv.includes("--update");
  const source = loadSeedEnv();
  if (!process.env.MONGODB_URI?.trim() || source === "missing") {
    console.error("MONGODB_URI is not set. Add it to .env.local or .env and run the importer again. The value is not printed.");
    process.exitCode = 1;
    return;
  }

  console.log(`Using MONGODB_URI from ${source}. The value is not printed.`);
  console.log(apply ? "Apply mode. New draft products may be written. Nothing is deleted." : "Dry run. No products will be written.");
  if (update) {
    console.log(
      apply
        ? "Update mode will replace image arrays for products that already use the import slug and SKU. Other fields stay as saved."
        : "Update mode is only a preview until --apply is set.",
    );
  }

  mongoose.set("autoIndex", false);
  const { connectToDatabase, disconnectDatabase } = await import("@/lib/mongodb");
  const { Category } = await import("@/lib/models/category");
  const { Product } = await import("@/lib/models/product");

  await connectToDatabase();
  const databaseName = mongoose.connection.name || "(unnamed)";
  console.log(`Database name: ${databaseName}.`);

  try {
    const stored = await Category.find({})
      .select("slug name")
      .limit(200)
      .lean<Array<{ slug: string; name: string }>>();
    const categories = stored.length > 0 ? stored : seedCategories.map((category) => ({ slug: category.slug, name: category.name }));
    if (stored.length === 0) {
      console.log("No category documents are stored. Only the original Kani, embroidered, and everyday names can match until categories are created in the admin.");
    }
    const products = await Product.find({})
      .select("slug sku status pricePaise images.url")
      .limit(5000)
      .lean<Array<{ slug: string; sku: string; status?: string; pricePaise?: number; images?: Array<{ url: string }> }>>();
    const shawls = await discoverShawls(path.join(process.cwd(), "public"));
    const rows = planShawlImport({
      shawls,
      categories,
      products: products.map((product) => ({
        slug: product.slug,
        sku: product.sku,
        status: product.status,
        pricePaise: product.pricePaise,
        imageUrls: product.images?.map((image) => image.url) ?? [],
      })),
      update,
    });

    for (const folder of SHAWL_SOURCES) {
      const found = shawls.filter((shawl) => shawl.sourceDirectory === folder.directory && shawl.images.length > 0);
      const imageCount = found.reduce((total, shawl) => total + shawl.images.length, 0);
      console.log(`${folder.directory}: ${found.length} shawl folder${found.length === 1 ? "" : "s"}, ${imageCount} supported image${imageCount === 1 ? "" : "s"}.`);
    }
    console.log("");
    for (const row of rows) {
      printRow(row);
    }
    const count = (action: ImportPlanRow["action"]) => rows.filter((row) => row.action === action).length;
    console.log("");
    console.log(
      `Summary: ${count("create")} to create, ${count("already-imported")} already imported, ${count("images-incomplete")} with incomplete images, ${count("update")} image updates, ${count("conflict")} conflicts, ${count("missing-category")} missing categories, ${count("skip")} skipped.`,
    );

    if (!apply) {
      console.log("Dry run finished. No products were written.");
      return;
    }

    for (const row of rows) {
      if (!row.draft || (row.action !== "create" && row.action !== "update")) {
        continue;
      }
      const parsed = validateProductDraft({
        name: row.draft.name,
        slug: row.draft.slug,
        description: row.draft.description,
        shortDescription: "",
        category: row.draft.category,
        collectionSlugs: [],
        priceRupees: String(row.draft.pricePaise / 100),
        compareAtRupees: "",
        sku: row.draft.sku,
        stockQuantity: String(row.draft.stockQuantity),
        status: "draft",
        featured: false,
        images: row.draft.images,
        material: "",
        dimensions: "",
        care: "",
        color: "",
        weave: "",
        embroidery: "",
        size: "",
        variantGroup: "",
        variantLabel: "",
        expectedUpdatedAt: "",
        linkSourceId: "",
      });
      if (!parsed.ok) {
        console.log(`Skipped ${row.source}: ${parsed.message}`);
        continue;
      }
      if (row.action === "create") {
        await Product.create({
          name: parsed.value.name,
          slug: parsed.value.slug,
          description: parsed.value.description,
          category: parsed.value.category,
          collectionSlugs: parsed.value.collectionSlugs,
          pricePaise: parsed.value.pricePaise,
          sku: parsed.value.sku,
          stockQuantity: parsed.value.stockQuantity,
          active: false,
          status: "draft",
          featured: false,
          images: parsed.value.images,
          currency: "INR",
        });
        console.log(`Created draft ${parsed.value.slug}.`);
        continue;
      }
      const result = await Product.updateOne(
        { slug: parsed.value.slug, sku: parsed.value.sku },
        { $set: importerImagePatch(row.draft) },
      );
      console.log(
        result.matchedCount === 1
          ? `Updated images on ${parsed.value.slug}. Publication status and other fields were left unchanged.`
          : `Skipped ${parsed.value.slug}: the imported record was not found.`,
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`Shawl import failed: ${redactSecrets(detail)}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
