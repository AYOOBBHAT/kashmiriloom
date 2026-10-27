import type { ProductDto } from "@/lib/products/types";

/** Fields the header search and bag read. Gallery files stay on the server. */
export type CatalogueClientProduct = {
  slug: string;
  name: string;
  description: string;
  categoryName: string;
  pricePaise: number;
  image: string;
  imageAlt: string;
  available: boolean;
  stockQuantity: number;
};

export function catalogueClientProduct(product: ProductDto): CatalogueClientProduct {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    categoryName: product.categoryName,
    pricePaise: product.pricePaise,
    image: product.image,
    imageAlt: product.imageAlt,
    available: product.available,
    stockQuantity: product.stockQuantity,
  };
}
