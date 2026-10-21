import type { CollectionId } from "@/data/catalog";
import { rupeesToPaise } from "@/lib/money";

/** Sample inventory for the seeded edit. This is not a warehouse count. */
export const SAMPLE_STOCK_QUANTITY = 4;

export type SampleProduct = {
  name: string;
  slug: string;
  description: string;
  category: CollectionId;
  pricePaise: number;
  images: { url: string; alt: string }[];
  sku: string;
  stockQuantity: number;
  active: true;
  featured: true;
  currency: "INR";
};

function sample(input: {
  name: string;
  slug: string;
  sku: string;
  category: CollectionId;
  rupees: number;
  summary: string;
  detail: string;
  image: string;
  imageAlt: string;
}): SampleProduct {
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    category: input.category,
    pricePaise: rupeesToPaise(input.rupees),
    description: `${input.summary} ${input.detail} The price and the quantity on this record are samples.`,
    images: [{ url: input.image, alt: input.imageAlt }],
    stockQuantity: SAMPLE_STOCK_QUANTITY,
    active: true,
    featured: true,
    currency: "INR",
  };
}

/** The six shawls from the existing catalogue. Slugs stay stable. */
export const sampleProducts: SampleProduct[] = [
  sample({
    name: "Nishat Kani Shawl",
    slug: "nishat",
    sku: "KL-SAMPLE-NISHAT",
    category: "kani",
    rupees: 86000,
    summary: "Burgundy ground with large gold paisleys along the field and border.",
    detail:
      "A folded burgundy shawl with large gold paisleys across the field and along the border. It is part of the Kani sample edit.",
    image: "/images/shawl-nishat.jpg",
    imageAlt: "Folded burgundy shawl with large gold paisley motifs, photographed on ivory linen.",
  }),
  sample({
    name: "Dal Garden Sozni",
    slug: "dal-garden",
    sku: "KL-SAMPLE-DAL-GARDEN",
    category: "embroidered",
    rupees: 42500,
    summary: "Ivory field with a deep floral border in burgundy, green, and gold.",
    detail:
      "An ivory shawl folded to show a deep floral border in burgundy, green, and gold. It is part of the embroidered sample edit.",
    image: "/images/shawl-dal.jpg",
    imageAlt: "Folded ivory shawl with a wide corner border of burgundy and green flowers.",
  }),
  sample({
    name: "Chinar Wrap",
    slug: "chinar",
    sku: "KL-SAMPLE-CHINAR",
    category: "everyday",
    rupees: 9800,
    summary: "Rust wool with tonal chinar leaves and a narrow gold edge.",
    detail:
      "A rust wrap with tonal chinar leaves and a narrow gold edge. It is part of the everyday sample edit.",
    image: "/images/shawl-chinar.jpg",
    imageAlt: "Folded rust-coloured shawl woven with brown chinar leaves and a gold border.",
  }),
  sample({
    name: "Zabarwan Paisley",
    slug: "zabarwan",
    sku: "KL-SAMPLE-ZABARWAN",
    category: "kani",
    rupees: 74000,
    summary: "Forest green scattered with small gold butis and a woven border.",
    detail:
      "A forest-green shawl scattered with small gold paisleys and finished with a woven border. It is part of the Kani sample edit.",
    image: "/images/shawl-zabarwan.jpg",
    imageAlt: "Folded forest-green shawl covered in small gold paisley motifs with a patterned hem.",
  }),
  sample({
    name: "Gulab Sozni Stole",
    slug: "gulab",
    sku: "KL-SAMPLE-GULAB",
    category: "embroidered",
    rupees: 28400,
    summary: "Blush ground with rose sprigs and a fine burgundy hem.",
    detail:
      "A blush stole with scattered rose sprigs and a fine burgundy hem. It is part of the embroidered sample edit.",
    image: "/images/shawl-gulab.jpg",
    imageAlt: "Folded blush shawl with scattered rose embroidery and a narrow burgundy edge.",
  }),
  sample({
    name: "Sheen Everyday Shawl",
    slug: "sheen",
    sku: "KL-SAMPLE-SHEEN",
    category: "everyday",
    rupees: 7600,
    summary: "Ivory herringbone wool, left unpatterned and light.",
    detail:
      "An ivory shawl in a fine herringbone, left unpatterned. It is part of the everyday sample edit.",
    image: "/images/shawl-sheen.jpg",
    imageAlt: "Folded plain ivory shawl with a fine herringbone weave.",
  }),
];

export const sampleProductSlugs = sampleProducts.map((product) => product.slug);
