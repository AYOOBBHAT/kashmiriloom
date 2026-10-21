import "server-only";

import { io } from "next/cache";
import type { CollectionId } from "@/data/catalog";
import {
  CatalogueAccessError,
  UNAVAILABLE_MESSAGE,
  redactSecrets,
  toProblem,
  type CatalogueProblem,
} from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Product, type ProductAttrs } from "@/lib/models/product";
import { isPaise } from "@/lib/money";
import { publicImage } from "@/lib/products/images";
import { summaryFromDescription } from "@/lib/products/summary";
import type { ProductDto } from "@/lib/products/types";
import { MAX_PUBLIC_PRODUCTS, type ShopQuery, type ShopSort } from "@/lib/shop";

const publicFields =
  "name slug description category pricePaise compareAtPricePaise images sku stockQuantity featured currency material dimensions care";

type ProductRecord = Pick<
  ProductAttrs,
  | "name"
  | "slug"
  | "description"
  | "category"
  | "pricePaise"
  | "images"
  | "sku"
  | "stockQuantity"
  | "featured"
  | "currency"
> & {
  compareAtPricePaise?: number | null;
  material?: string;
  dimensions?: string;
  care?: string;
};

export type CatalogueResult<T> =
  | { ok: true; data: T }
  | { ok: false; problem: CatalogueProblem };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toDto(record: ProductRecord): ProductDto | null {
  if (record.currency !== "INR" || !isPaise(record.pricePaise)) {
    console.error("Skipped a catalogue product with an invalid price or currency.");
    return null;
  }
  if (!Number.isInteger(record.stockQuantity) || record.stockQuantity < 0) {
    console.error("Skipped a catalogue product with an invalid quantity.");
    return null;
  }

  const gallery: ProductDto["images"] = [];
  const seen = new Set<string>();
  for (const image of record.images ?? []) {
    if (!image?.url) {
      continue;
    }
    const safe = publicImage(image.url, image.alt ?? "", record.category);
    if (seen.has(safe.src)) {
      continue;
    }
    seen.add(safe.src);
    gallery.push(safe);
  }
  if (gallery.length === 0) {
    gallery.push(publicImage("", "", record.category));
  }
  const compare = record.compareAtPricePaise;
  const compareAtPricePaise =
    compare != null && isPaise(compare) && compare > record.pricePaise ? compare : null;

  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    summary: summaryFromDescription(record.description),
    category: record.category,
    pricePaise: record.pricePaise,
    compareAtPricePaise,
    images: gallery,
    image: gallery[0]?.src ?? publicImage("", "", record.category).src,
    imageAlt: gallery[0]?.alt ?? publicImage("", "", record.category).alt,
    sku: record.sku,
    stockQuantity: record.stockQuantity,
    featured: record.featured,
    available: record.stockQuantity > 0,
    material: optionalText(record.material),
    dimensions: optionalText(record.dimensions),
    care: optionalText(record.care),
  };
}

function sortSpec(sort: ShopSort): Record<string, 1 | -1> {
  if (sort === "price-asc") {
    return { pricePaise: 1, name: 1 };
  }
  if (sort === "price-desc") {
    return { pricePaise: -1, name: 1 };
  }
  if (sort === "name") {
    return { name: 1 };
  }
  return { createdAt: 1, name: 1 };
}

type CatalogueFilter = {
  slug?: string | { $ne: string };
  category?: CollectionId;
  featured?: boolean;
  $or?: Array<Record<string, { $regex: string; $options: string }>>;
};

async function readProducts(filter: CatalogueFilter, sort: ShopSort, limit: number) {
  await io();
  try {
    await connectToDatabase();
    const docs = await Product.find({ ...filter, active: true })
      .select(publicFields)
      .sort(sortSpec(sort))
      .limit(limit)
      .lean<ProductRecord[]>();
    return docs.flatMap((doc) => {
      const product = toDto(doc);
      return product ? [product] : [];
    });
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Catalogue query failed: ${redactSecrets(detail)}`);
    throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
  }
}

export async function withCatalogue<T>(work: () => Promise<T>): Promise<CatalogueResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      return { ok: false, problem: toProblem(error) };
    }
    throw error;
  }
}

export function listActiveProducts(): Promise<ProductDto[]> {
  return readProducts({}, "edited", MAX_PUBLIC_PRODUCTS);
}

export function listFeaturedProducts(): Promise<ProductDto[]> {
  return readProducts({ featured: true }, "edited", 12);
}

export function listProductsByCategory(category: CollectionId): Promise<ProductDto[]> {
  return readProducts({ category }, "edited", MAX_PUBLIC_PRODUCTS);
}

export async function getProductBySlug(slug: string): Promise<ProductDto | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return null;
  }
  const products = await readProducts({ slug }, "edited", 1);
  return products[0] ?? null;
}

export function listRelatedProducts(category: CollectionId, slug: string): Promise<ProductDto[]> {
  return readProducts({ category, slug: { $ne: slug } }, "edited", 4);
}

export function searchProducts(query: ShopQuery): Promise<ProductDto[]> {
  const filter: CatalogueFilter = {};
  if (query.category !== "all") {
    filter.category = query.category;
  }
  if (query.search) {
    const pattern = escapeRegex(query.search.slice(0, 80));
    filter.$or = [
      { name: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
    ];
  }
  return readProducts(filter, query.sort, MAX_PUBLIC_PRODUCTS);
}
