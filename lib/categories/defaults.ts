import { collections } from "@/data/catalog";

export type CategorySeed = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  displayOrder: number;
};

/** The three collections already used by the shop. Seeding inserts these once. */
export const seedCategories: CategorySeed[] = collections.map((collection, index) => ({
  name: collection.name,
  slug: collection.slug,
  description: collection.description,
  imageUrl: collection.image,
  imageAlt: collection.imageAlt,
  displayOrder: index,
}));

export function fallbackCategoryName(slug: string): string {
  return seedCategories.find((category) => category.slug === slug)?.name ?? slug;
}
