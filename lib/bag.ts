export const BAG_STORAGE_KEY = "kashmiriloom-bag";
export const MAX_BAG_QUANTITY = 9;

export type BagLine = {
  slug: string;
  quantity: number;
};

export type AddBagResult = {
  lines: BagLine[];
  clamped: boolean;
};

function cleanQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }
  return Math.floor(quantity);
}

export function parseBag(value: string | null, knownSlugs: ReadonlySet<string> | null): BagLine[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const lines: BagLine[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const slug = "slug" in item && typeof item.slug === "string" ? item.slug : "";
      const quantity =
        "quantity" in item && typeof item.quantity === "number" ? cleanQuantity(item.quantity) : 0;
      if (!slug || quantity < 1 || seen.has(slug) || (knownSlugs !== null && !knownSlugs.has(slug))) {
        continue;
      }
      seen.add(slug);
      lines.push({ slug, quantity: Math.min(MAX_BAG_QUANTITY, quantity) });
    }
    return lines;
  } catch {
    return [];
  }
}

export function addBagLine(lines: BagLine[], slug: string, quantity: number): AddBagResult {
  const add = Math.max(1, cleanQuantity(quantity));
  const existing = lines.find((line) => line.slug === slug);
  const nextQuantity = Math.min(MAX_BAG_QUANTITY, (existing?.quantity ?? 0) + add);
  const clamped = (existing?.quantity ?? 0) + add > MAX_BAG_QUANTITY;
  const next = existing
    ? lines.map((line) => (line.slug === slug ? { slug, quantity: nextQuantity } : line))
    : [...lines, { slug, quantity: nextQuantity }];
  return { lines: next, clamped };
}

export function setBagQuantity(lines: BagLine[], slug: string, quantity: number): BagLine[] {
  const nextQuantity = cleanQuantity(quantity);
  if (nextQuantity < 1) {
    return lines.filter((line) => line.slug !== slug);
  }
  return lines.map((line) =>
    line.slug === slug
      ? { slug, quantity: Math.min(MAX_BAG_QUANTITY, nextQuantity) }
      : line,
  );
}

export function removeBagLine(lines: BagLine[], slug: string): BagLine[] {
  return lines.filter((line) => line.slug !== slug);
}

export function bagCount(lines: BagLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** `priceFor` must return integer paise. The product is a whole number of paise. */
export function bagSubtotal(lines: BagLine[], priceFor: (slug: string) => number): number {
  return lines.reduce((sum, line) => sum + priceFor(line.slug) * line.quantity, 0);
}
