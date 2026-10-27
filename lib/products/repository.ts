import "server-only";

import { cacheLife, cacheTag, io } from "next/cache";
import { categoryNameMap, labelForCategory } from "@/lib/categories/public";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue/public-tag";
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
import { categoryMembership } from "@/lib/products/membership";
import { primaryOf } from "@/lib/products/gallery";
import { publicImage } from "@/lib/products/images";
import { summaryFromDescription } from "@/lib/products/summary";
import type { ProductDto, ProductVariantChoice } from "@/lib/products/types";
import { MAX_PUBLIC_PRODUCTS, type ShopQuery, type ShopSort } from "@/lib/shop";

const publicFields =
  "name slug description shortDescription category pricePaise compareAtPricePaise images sku stockQuantity featured currency material dimensions care color weave embroidery size variantGroup variantLabel";

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
  shortDescription?: string;
  compareAtPricePaise?: number | null;
  material?: string;
  dimensions?: string;
  care?: string;
  color?: string;
  weave?: string;
  embroidery?: string;
  size?: string;
  variantGroup?: string;
  variantLabel?: string;
  images: { url: string; alt: string; primary?: boolean }[];
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

function toDto(record: ProductRecord, names: Map<string, string>, variants: ProductVariantChoice[] = []): ProductDto | null {
  if (record.currency !== "INR" || !isPaise(record.pricePaise)) {
    console.error("Skipped a catalogue product with an invalid price or currency.");
    return null;
  }
  if (!Number.isInteger(record.stockQuantity) || record.stockQuantity < 0) {
    console.error("Skipped a catalogue product with an invalid quantity.");
    return null;
  }

  const gallery: Array<ProductDto["images"][number] & { primary?: boolean }> = [];
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
    gallery.push({ ...safe, primary: image.primary === true });
  }
  if (gallery.length === 0) {
    gallery.push({ ...publicImage("", "", record.category), primary: true });
  }
  const lead = primaryOf(gallery) ?? gallery[0];
  const compare = record.compareAtPricePaise;
  const compareAtPricePaise =
    compare != null && isPaise(compare) && compare > record.pricePaise ? compare : null;

  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    summary: record.shortDescription?.trim() || summaryFromDescription(record.description),
    category: record.category,
    categoryName: labelForCategory(record.category, names),
    pricePaise: record.pricePaise,
    compareAtPricePaise,
    images: gallery.map(({ src, alt }) => ({ src, alt })),
    image: lead?.src ?? publicImage("", "", record.category).src,
    imageAlt: lead?.alt ?? publicImage("", "", record.category).alt,
    sku: record.sku,
    stockQuantity: record.stockQuantity,
    featured: record.featured,
    available: record.stockQuantity > 0,
    material: optionalText(record.material),
    dimensions: optionalText(record.dimensions),
    care: optionalText(record.care),
    color: optionalText(record.color),
    weave: optionalText(record.weave),
    embroidery: optionalText(record.embroidery),
    size: optionalText(record.size),
    variantLabel: optionalText(record.variantLabel),
    variants,
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

async function readProducts(filter: Record<string, unknown>, sort: ShopSort, limit: number) {
  "use cache";
  cacheTag(PUBLIC_CATALOGUE_TAG);
  cacheLife("minutes");
  await io();
  try {
    await connectToDatabase();
    const [names, docs] = await Promise.all([
      categoryNameMap(),
      Product.find({ ...filter, active: true })
        .select(publicFields)
        .sort(sortSpec(sort))
        .limit(limit)
        .lean<ProductRecord[]>(),
    ]);
    return docs.flatMap((doc) => {
      const product = toDto(doc, names);
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

export function listProductsByCategory(category: string): Promise<ProductDto[]> {
  return readProducts(categoryMembership(category), "edited", MAX_PUBLIC_PRODUCTS);
}

export async function getProductBySlug(slug: string): Promise<ProductDto | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return null;
  }
  const products = await readProducts({ slug }, "edited", 1);
  return products[0] ?? null;
}

export function listRelatedProducts(category: string, slug: string): Promise<ProductDto[]> {
  return readProducts({ ...categoryMembership(category), slug: { $ne: slug } }, "edited", 4);
}

export async function variantChoices(group: string, slug: string): Promise<ProductVariantChoice[]> {
  if (!group) {
    return [];
  }
  await io();
  await connectToDatabase();
  const docs = await Product.find({ active: true, variantGroup: group, slug: { $ne: slug } })
    .select("slug name variantLabel pricePaise stockQuantity currency")
    .sort({ name: 1 })
    .limit(12)
    .lean<Array<{ slug: string; name: string; variantLabel?: string; pricePaise: number; stockQuantity: number; currency: string }>>();
  return docs.flatMap((doc) => {
    if (doc.currency !== "INR" || !isPaise(doc.pricePaise)) {
      return [];
    }
    return [
      {
        slug: doc.slug,
        name: doc.name,
        label: doc.variantLabel?.trim() || doc.name,
        pricePaise: doc.pricePaise,
        available: doc.stockQuantity > 0,
      },
    ];
  });
}

export type PublicProductRoute =
  | { kind: "product"; product: ProductDto }
  | { kind: "redirect"; slug: string }
  | { kind: "missing" };

export async function getPublicProductRoute(slug: string): Promise<PublicProductRoute> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return { kind: "missing" };
  }
  const product = await getProductBySlug(slug);
  if (product) {
    const variants = product ? await variantChoicesFor(product.slug) : [];
    return { kind: "product", product: { ...product, variants } };
  }
  await io();
  await connectToDatabase();
  const moved = await Product.findOne({ active: true, previousSlugs: slug }).select("slug").lean<{ slug: string } | null>();
  if (moved && moved.slug !== slug) {
    return { kind: "redirect", slug: moved.slug };
  }
  return { kind: "missing" };
}

async function variantChoicesFor(slug: string): Promise<ProductVariantChoice[]> {
  const record = await Product.findOne({ slug, active: true }).select("variantGroup").lean<{ variantGroup?: string } | null>();
  return variantChoices(record?.variantGroup ?? "", slug);
}

export function searchProducts(query: ShopQuery): Promise<ProductDto[]> {
  const parts: Record<string, unknown>[] = [];
  if (query.category !== "all") {
    parts.push(categoryMembership(query.category));
  }
  if (query.search) {
    const pattern = escapeRegex(query.search.slice(0, 80));
    parts.push({
      $or: [
        { name: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
        { shortDescription: { $regex: pattern, $options: "i" } },
      ],
    });
  }
  const filter = parts.length === 0 ? {} : parts.length === 1 ? (parts[0] ?? {}) : { $and: parts };
  return readProducts(filter, query.sort, MAX_PUBLIC_PRODUCTS);
}
