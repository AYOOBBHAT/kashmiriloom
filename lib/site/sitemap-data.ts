import "server-only";

import { connection } from "next/server";
import { listPublicCategories } from "@/lib/categories/public";
import { CatalogueAccessError, redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/lib/models/category";
import { Product } from "@/lib/models/product";
import { publicSitemapEntries, type DatedSlug } from "@/lib/site/sitemap-entries";

const MAX_RECORDS = 1000;

export async function loadPublicSitemap() {
  await connection();
  try {
    await connectToDatabase();
    const categories = await listPublicCategories();
    const slugs = categories.map((category) => category.slug);
    const [categoryDocs, productDocs] = await Promise.all([
      Category.find({ slug: { $in: slugs }, active: true })
        .select("slug updatedAt")
        .limit(MAX_RECORDS)
        .lean<DatedSlug[]>(),
      Product.find({ active: true })
        .select("slug updatedAt pricePaise currency")
        .sort({ updatedAt: -1 })
        .limit(MAX_RECORDS)
        .lean<DatedSlug[]>(),
    ]);
    const dated = new Map(categoryDocs.flatMap((doc) => (typeof doc.slug === "string" ? [[doc.slug, doc.updatedAt] as const] : [])));
    return publicSitemapEntries({
      categories: categories.map((category) => ({ slug: category.slug, updatedAt: dated.get(category.slug) ?? null })),
      products: productDocs,
    });
  } catch (error) {
    const detail = error instanceof CatalogueAccessError ? "unavailable" : error instanceof Error ? error.message : "Unknown catalogue error";
    console.error(`Sitemap could not read the catalogue: ${redactSecrets(detail)}`);
    return publicSitemapEntries({ products: [], categories: [] });
  }
}
