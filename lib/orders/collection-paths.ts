import { isSlug } from "@/lib/catalogue/slug";

const MAX_PATHS = 64;

export function collectionPathsFromProducts(
  products: Array<{ category?: unknown; collectionSlugs?: unknown }>,
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const extras = Array.isArray(product.collectionSlugs) ? product.collectionSlugs : [];
    for (const value of [product.category, ...extras]) {
      if (typeof value !== "string" || !isSlug(value) || seen.has(value)) {
        continue;
      }
      seen.add(value);
      paths.push(`/collections/${value}`);
      if (paths.length >= MAX_PATHS) {
        return paths;
      }
    }
  }
  return paths;
}
