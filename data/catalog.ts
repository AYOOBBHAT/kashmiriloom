export type CollectionId = "kani" | "embroidered" | "everyday";

export type Collection = {
  id: CollectionId;
  slug: string;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  featuredShawlId: string;
};

export type NavItem = {
  href: string;
  label: string;
};

export const primaryNav: NavItem[] = [
  { href: "/shop", label: "Shop" },
  { href: "/#collections", label: "Collections" },
  { href: "/#story", label: "Our Story" },
  { href: "/#contact", label: "Contact" },
];

export const collectionLabels: Record<CollectionId, string> = {
  kani: "Kani weave",
  embroidered: "Embroidered",
  everyday: "Everyday wool",
};

export const collections: Collection[] = [
  {
    id: "kani",
    slug: "kani",
    name: "Kani shawls",
    description:
      "Paisley and floral fields woven in with wooden bobbins, motif by motif.",
    image: "/images/collection-kani.jpg",
    imageAlt:
      "Close view of a burgundy shawl covered in gold and forest-green paisley weaving.",
    featuredShawlId: "nishat",
  },
  {
    id: "embroidered",
    slug: "embroidered",
    name: "Embroidered shawls",
    description:
      "Sozni flowers and vines drawn with a needle on a quiet ground.",
    image: "/images/collection-embroidered.jpg",
    imageAlt:
      "Ivory wool shawl with burgundy flowers, green leaves, and gold vines embroidered across the cloth.",
    featuredShawlId: "dal-garden",
  },
  {
    id: "everyday",
    slug: "everyday",
    name: "Everyday shawls",
    description:
      "Softer wraps with a simple border, for days without ceremony.",
    image: "/images/collection-everyday.jpg",
    imageAlt:
      "A forest-green wool shawl with a wide ivory border, folded on a stone ledge.",
    featuredShawlId: "chinar",
  },
];

export const benefits = [
  {
    title: "Prices in rupees",
    body: "Every piece on this page is listed in Indian rupees, so the edit is easy to compare.",
  },
  {
    title: "Weaves, named",
    body: "Kani, needle embroidery, and everyday wool are labeled, so the technique is clear before the cloth is.",
  },
  {
    title: "A short edit",
    body: "The house shows a few shawls at a time, with room to see the pattern instead of an endless grid.",
  },
  {
    title: "Care, in plain words",
    body: "Fold embroidery to the inside, air wool rather than sealing it in plastic, and store it clean and dry. This is guidance, not a warranty.",
  },
] as const;

export function availabilityLabel(available: boolean): string {
  return available ? "Listed in this sample edit" : "Not listed in this edit";
}

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((collection) => collection.slug === slug);
}
