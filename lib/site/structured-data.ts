import { isSlug } from "@/lib/catalogue/slug";
import { isPaise } from "@/lib/money";
import { STORE_NAME, STORE_ORIGIN } from "@/lib/site/policies";
import { absoluteUrl } from "@/lib/site/sitemap-entries";

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

export type StructuredProduct = {
  name: string;
  description: string;
  slug: string;
  sku: string;
  pricePaise: number;
  available: boolean;
  category: string;
  categoryName: string;
  images: Array<{ src: string }>;
};

export function rupeesFromPaise(paise: number): string | null {
  if (!isPaise(paise)) {
    return null;
  }
  const rupees = Math.trunc(paise / 100);
  const remainder = paise % 100;
  return `${rupees}.${String(remainder).padStart(2, "0")}`;
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function productPageJsonLd(product: StructuredProduct | null): Record<string, unknown> | null {
  if (!product || !isSlug(product.slug) || product.name.trim() === "") {
    return null;
  }
  const price = rupeesFromPaise(product.pricePaise);
  if (!price) {
    return null;
  }
  const url = absoluteUrl(`/products/${product.slug}`);
  const images = product.images.flatMap((image) => {
    const absolute = absoluteImage(image.src);
    return absolute ? [absolute] : [];
  });
  const graph: Record<string, unknown> = {
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price,
      availability: product.available ? IN_STOCK : OUT_OF_STOCK,
      seller: {
        "@type": "Organization",
        name: STORE_NAME,
        url: STORE_ORIGIN,
      },
    },
    brand: {
      "@type": "Brand",
      name: STORE_NAME,
    },
  };
  if (product.description.trim()) {
    graph.description = product.description;
  }
  if (images.length > 0) {
    graph.image = images;
  }
  const breadcrumb = productBreadcrumb(product, url);
  return {
    "@context": "https://schema.org",
    "@graph": breadcrumb ? [graph, breadcrumb] : [graph],
  };
}

function productBreadcrumb(product: StructuredProduct, productUrl: string): Record<string, unknown> | null {
  if (!isSlug(product.category) || product.categoryName.trim() === "") {
    return null;
  }
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Shop",
        item: absoluteUrl("/shop"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.categoryName,
        item: absoluteUrl(`/collections/${product.category}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl,
      },
    ],
  };
}

function absoluteImage(src: string): string | null {
  if (src.startsWith("/") && !src.startsWith("//") && !src.includes("..") && !src.includes("\\") && !/[\s]/.test(src)) {
    return absoluteUrl(src);
  }
  if (src.startsWith("https://") && src.length <= 500 && !/[\s\\]/.test(src)) {
    return src;
  }
  return null;
}
