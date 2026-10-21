import "server-only";

import { io } from "next/cache";
import { fallbackCategoryName, seedCategories } from "@/lib/categories/defaults";
import { loadCategoryNames } from "@/lib/categories/names";
import { isSlug } from "@/lib/catalogue/slug";
import {
  CatalogueAccessError,
  UNAVAILABLE_MESSAGE,
  redactSecrets,
} from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/lib/models/category";
import { publicImage } from "@/lib/products/images";

export type PublicCategory = {
  slug: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  displayOrder: number;
};

type CategoryRoute =
  | { kind: "active"; category: PublicCategory }
  | { kind: "redirect"; slug: string }
  | { kind: "fallback"; category: PublicCategory }
  | { kind: "missing" };

function fallbackList(): PublicCategory[] {
  return seedCategories.map((category) => ({
    slug: category.slug,
    name: category.name,
    description: category.description,
    image: category.imageUrl,
    imageAlt: category.imageAlt,
    displayOrder: category.displayOrder,
  }));
}

function toPublic(record: {
  slug: string;
  name: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  displayOrder: number;
}): PublicCategory {
  const image = publicImage(record.imageUrl ?? "", record.imageAlt ?? "", record.slug);
  return {
    slug: record.slug,
    name: record.name,
    description: record.description,
    image: image.src,
    imageAlt: image.alt,
    displayOrder: record.displayOrder,
  };
}

async function readCategories(): Promise<{ stored: boolean; active: PublicCategory[] }> {
  await io();
  try {
    await connectToDatabase();
    const count = await Category.countDocuments({});
    if (count === 0) {
      return { stored: false, active: fallbackList() };
    }
    const docs = await Category.find({ active: true })
      .select("slug name description imageUrl imageAlt displayOrder")
      .sort({ displayOrder: 1, name: 1 })
      .limit(100)
      .lean<
        Array<{
          slug: string;
          name: string;
          description: string;
          imageUrl?: string;
          imageAlt?: string;
          displayOrder: number;
        }>
      >();
    return { stored: true, active: docs.map(toPublic) };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Category query failed: ${redactSecrets(detail)}`);
    throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
  }
}

export async function listPublicCategories(): Promise<PublicCategory[]> {
  const result = await readCategories();
  return result.active;
}

export async function categoryNameMap(): Promise<Map<string, string>> {
  await io();
  return loadCategoryNames();
}

export function labelForCategory(slug: string, names?: Map<string, string>): string {
  return names?.get(slug) ?? fallbackCategoryName(slug);
}

export async function resolveCategoryRoute(slug: string): Promise<CategoryRoute> {
  if (!isSlug(slug)) {
    return { kind: "missing" };
  }
  await io();
  try {
    await connectToDatabase();
    const count = await Category.countDocuments({});
    if (count === 0) {
      const fallback = fallbackList().find((category) => category.slug === slug);
      return fallback ? { kind: "fallback", category: fallback } : { kind: "missing" };
    }
    const current = await Category.findOne({ slug })
      .select("slug name description imageUrl imageAlt displayOrder active")
      .lean<{
        slug: string;
        name: string;
        description: string;
        imageUrl?: string;
        imageAlt?: string;
        displayOrder: number;
        active: boolean;
      } | null>();
    if (current?.active) {
      return { kind: "active", category: toPublic(current) };
    }
    if (current) {
      return { kind: "missing" };
    }
    const moved = await Category.findOne({ previousSlugs: slug, active: true }).select("slug").lean<{ slug: string } | null>();
    if (moved && moved.slug !== slug) {
      return { kind: "redirect", slug: moved.slug };
    }
    return { kind: "missing" };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Category query failed: ${redactSecrets(detail)}`);
    throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
  }
}
