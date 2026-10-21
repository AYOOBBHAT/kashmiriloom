/**
 * Inserts or updates the six sample shawls.
 * Run with `pnpm seed`. This file is not imported by the app.
 *
 * A product is updated only when its slug and sample SKU both match.
 * Any other saved product is left unchanged. Nothing is deleted.
 * Repeating the seed writes the sample price, sample inventory, copy, and featured flag again.
 * It does not turn a hidden sample product back on.
 */
import { sampleProducts } from "@/data/sample-products";
import { CatalogueAccessError, redactSecrets } from "@/lib/catalogue-error";
import { disconnectDatabase, connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/lib/models/product";
import { formatInrFromPaise } from "@/lib/money";
import { loadSeedEnv } from "./load-env";

async function main() {
  const source = loadSeedEnv();
  if (!process.env.MONGODB_URI?.trim() || source === "missing") {
    console.error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example) and run pnpm seed again.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Using MONGODB_URI from ${source}. The value is not printed.`);
  console.log(
    "Sample seed only. Prices and inventory are samples. Products with a different SKU are skipped. Nothing is deleted.",
  );

  await connectToDatabase();
  await Product.createIndexes();

  for (const sample of sampleProducts) {
    const existing = await Product.findOne({ slug: sample.slug }).select("sku active").lean<{
      sku: string;
      active: boolean;
    } | null>();

    if (!existing) {
      await Product.create(sample);
      console.log(
        `Inserted ${sample.slug} (${sample.sku}). Sample price ${formatInrFromPaise(sample.pricePaise)}. Sample inventory ${sample.stockQuantity}.`,
      );
      continue;
    }

    if (existing.sku !== sample.sku) {
      console.log(
        `Skipped ${sample.slug}: saved SKU does not match ${sample.sku}, so that product was left unchanged.`,
      );
      continue;
    }

    await Product.updateOne(
      { slug: sample.slug, sku: sample.sku },
      {
        $set: {
          name: sample.name,
          description: sample.description,
          category: sample.category,
          pricePaise: sample.pricePaise,
          images: sample.images,
          stockQuantity: sample.stockQuantity,
          featured: sample.featured,
          currency: sample.currency,
        },
      },
    );
    console.log(
      `Updated sample ${sample.slug}. Sample price ${formatInrFromPaise(sample.pricePaise)} and sample inventory ${sample.stockQuantity} were written. Active was left ${existing.active ? "on" : "off"}.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof CatalogueAccessError) {
      console.error(error.message);
    } else {
      const detail = error instanceof Error ? error.message : "Unknown seed error";
      console.error(`Seed failed. ${redactSecrets(detail)}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
  });
