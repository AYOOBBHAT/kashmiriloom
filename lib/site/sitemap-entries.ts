import { isSlug } from "@/lib/catalogue/slug";
import { isPaise } from "@/lib/money";
import { STORE_ORIGIN } from "@/lib/site/policies";

export function absoluteUrl(path: string): string {
  if (path === "/" || path === "") {
    return STORE_ORIGIN;
  }
  return `${STORE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export type DatedSlug = {
  slug?: unknown;
  updatedAt?: unknown;
  pricePaise?: unknown;
  currency?: unknown;
};

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
};

export function publicSitemapEntries(input: { products: DatedSlug[]; categories: DatedSlug[] }): SitemapEntry[] {
  const entries: SitemapEntry[] = [{ url: absoluteUrl("/") }, { url: absoluteUrl("/shop") }];
  const seen = new Set(entries.map((entry) => entry.url));
  for (const category of input.categories) {
    pushEntry(entries, seen, "/collections", category, false);
  }
  for (const product of input.products) {
    pushEntry(entries, seen, "/products", product, true);
  }
  return entries;
}

function pushEntry(entries: SitemapEntry[], seen: Set<string>, prefix: string, record: DatedSlug, priced: boolean): void {
  if (typeof record.slug !== "string" || !isSlug(record.slug)) {
    return;
  }
  if (priced && (record.currency !== "INR" || typeof record.pricePaise !== "number" || !isPaise(record.pricePaise))) {
    return;
  }
  const url = absoluteUrl(`${prefix}/${record.slug}`);
  if (seen.has(url)) {
    return;
  }
  seen.add(url);
  const entry: SitemapEntry = { url };
  const modified = modifiedAt(record.updatedAt);
  if (modified) {
    entry.lastModified = modified;
  }
  entries.push(entry);
}

function modifiedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  return null;
}
