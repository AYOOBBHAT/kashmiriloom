export type ProductImage = {
  src: string;
  alt: string;
};

export type ProductVariantChoice = {
  slug: string;
  name: string;
  label: string;
  pricePaise: number;
  available: boolean;
};

/** Plain catalogue record safe to pass from the server into client components. */
export type ProductDto = {
  slug: string;
  name: string;
  description: string;
  summary: string;
  category: string;
  categoryName: string;
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
  color?: string;
  weave?: string;
  embroidery?: string;
  size?: string;
  variantLabel?: string;
  variants: ProductVariantChoice[];
};
