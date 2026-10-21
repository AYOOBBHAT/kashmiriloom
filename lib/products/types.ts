import type { CollectionId } from "@/data/catalog";

export type ProductImage = {
  src: string;
  alt: string;
};

/** Plain catalogue record safe to pass from the server into client components. */
export type ProductDto = {
  slug: string;
  name: string;
  description: string;
  summary: string;
  category: CollectionId;
  pricePaise: number;
  compareAtPricePaise: number | null;
  images: ProductImage[];
  image: string;
  imageAlt: string;
  sku: string;
  stockQuantity: number;
  featured: boolean;
  available: boolean;
  material?: string;
  dimensions?: string;
  care?: string;
};
