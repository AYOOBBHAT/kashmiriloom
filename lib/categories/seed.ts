import "server-only";

import { seedCategories } from "@/lib/categories/defaults";
import { Category } from "@/lib/models/category";
import { Product } from "@/lib/models/product";

/**
 * Inserts the original three categories when their slugs are absent.
 * An existing category is left as the admin saved it. Nothing is deleted.
 * Also asks this database to build the product and category indexes.
 * Run it with `pnpm seed` against the same cluster the site uses.
 * A local run does not create indexes in a different Atlas cluster.
 */
export async function ensureCatalogueCategories(): Promise<void> {
  await Product.createIndexes();
  await Category.createIndexes();
  for (const seed of seedCategories) {
    const existing = await Category.findOne({ slug: seed.slug }).select("_id").lean();
    if (existing) {
      continue;
    }
    await Category.create({
      ...seed,
      active: true,
    });
  }
}
