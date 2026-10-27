import { readdir } from "node:fs/promises";
import path from "node:path";
import { SHAWL_IMAGE_EXTENSIONS, SHAWL_SOURCES } from "@/lib/catalogue/shawl-sources";
import { MAX_PRODUCT_IMAGES } from "@/lib/products/limits";
import { parseInrToPaise } from "@/lib/products/validate";

export const IMPORT_PRICE_RUPEES = "5000";
export const IMPORT_STOCK_QUANTITY = 1;
export { MAX_PRODUCT_IMAGES };

const pricePaise = parseInrToPaise(IMPORT_PRICE_RUPEES);

export type CatalogueCategory = { slug: string; name: string };

export type ExistingProduct = {
  slug: string;
  sku: string;
  imageUrls?: string[];
  status?: string;
  pricePaise?: number;
};

export type DiscoveredImage = { name: string; relativePath: string; url: string };

export type DiscoveredShawl = {
  sourceDirectory: string;
  folderName: string;
  relativeFolder: string;
  images: DiscoveredImage[];
  skippedFiles: string[];
  notes: string[];
};

export type ImportDraft = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  category: string;
  categoryName: string;
  pricePaise: number;
  stockQuantity: number;
  status: "draft";
  active: false;
  featured: false;
  currency: "INR";
  images: { url: string; alt: string; primary: boolean }[];
  omittedImages: string[];
};

export type ImportAction = "create" | "already-imported" | "images-incomplete" | "update" | "conflict" | "missing-category" | "skip";

export type ImportPlanRow = {
  source: string;
  action: ImportAction;
  reason: string;
  draft?: ImportDraft;
};

function sameImageUrls(existing: string[] | undefined, draft: ImportDraft): boolean {
  if (!existing) {
    return true;
  }
  const next = draft.images.map((image) => image.url);
  return existing.length === next.length && existing.every((url, index) => url === next[index]);
}

/** Fields an image repair is allowed to write. Publication and catalogue text stay as saved. */
export function importerImagePatch(draft: ImportDraft): { images: ImportDraft["images"] } {
  return {
    images: draft.images.map((image) => ({ url: image.url, alt: image.alt, primary: image.primary })),
  };
}

function extensionOf(name: string): string {
  return path.extname(name).toLowerCase();
}

function isImageName(name: string): boolean {
  return SHAWL_IMAGE_EXTENSIONS.some((extension) => extension === extensionOf(name));
}

export function displayName(folderName: string): string {
  return folderName.trim().replace(/[_]+/g, " ").replace(/\s+/g, " ");
}

export function importSlug(categorySlug: string, folderName: string): string {
  const folder = folderName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${categorySlug}-${folder}`.replace(/^-+|-+$/g, "").slice(0, 80);
}

export function importSku(categorySlug: string, folderName: string): string {
  const body = `${categorySlug}-${folderName}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `KL-${body}`.slice(0, 40);
}

export function importDescription(name: string, categoryName: string): string {
  return `${name}. A shawl in the ${categoryName} category.`;
}

export function publicImageUrl(sourceDirectory: string, relativeFile: string): string {
  const parts = [sourceDirectory, ...relativeFile.split(/[\\/]+/)].filter((part) => part.length > 0);
  return `/${parts.join("/")}`;
}

function matchCategory(
  source: (typeof SHAWL_SOURCES)[number],
  categories: CatalogueCategory[],
): CatalogueCategory | "ambiguous" | null {
  const matches = categories.filter((category) => {
    const name = category.name.trim().toLowerCase();
    return source.matchNames.some((item) => item === name) || source.matchSlugs.some((item) => item === category.slug);
  });
  if (matches.length > 1) {
    return "ambiguous";
  }
  return matches[0] ?? null;
}

async function filesIn(directory: string, prefix = ""): Promise<{ relativePath: string; name: string }[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  const found: { relativePath: string; name: string }[] = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...(await filesIn(path.join(directory, entry.name), relativePath)));
      continue;
    }
    found.push({ relativePath, name: entry.name });
  }
  return found;
}

export async function discoverShawls(publicDirectory: string): Promise<DiscoveredShawl[]> {
  const shawls: DiscoveredShawl[] = [];
  for (const source of SHAWL_SOURCES) {
    const root = path.join(publicDirectory, source.directory);
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        shawls.push({
          sourceDirectory: source.directory,
          folderName: entry.name,
          relativeFolder: entry.name,
          images: [],
          skippedFiles: [entry.name],
          notes: ["A file is sitting in the category folder, so it is not a shawl."],
        });
        continue;
      }
      const files = await filesIn(path.join(root, entry.name));
      const images: DiscoveredImage[] = [];
      const skippedFiles: string[] = [];
      const notes: string[] = [];
      if (files.some((file) => file.relativePath.includes("/"))) {
        notes.push("Images in nested folders are included in filename order.");
      }
      for (const file of files) {
        if (!isImageName(file.name)) {
          skippedFiles.push(file.relativePath);
          continue;
        }
        images.push({
          name: file.name,
          relativePath: file.relativePath,
          url: publicImageUrl(source.directory, path.join(entry.name, file.relativePath)),
        });
      }
      images.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
      shawls.push({
        sourceDirectory: source.directory,
        folderName: entry.name,
        relativeFolder: entry.name,
        images,
        skippedFiles,
        notes,
      });
    }
  }
  return shawls;
}

export function planShawlImport(input: {
  shawls: DiscoveredShawl[];
  categories: CatalogueCategory[];
  products: ExistingProduct[];
  update: boolean;
}): ImportPlanRow[] {
  const rows: ImportPlanRow[] = [];
  const seenSlugs = new Set<string>();
  const seenSkus = new Set<string>();
  for (const shawl of input.shawls) {
    const source = `${shawl.sourceDirectory}/${shawl.folderName}`;
    const definition = SHAWL_SOURCES.find((item) => item.directory === shawl.sourceDirectory);
    if (!definition) {
      rows.push({ source, action: "skip", reason: "That folder is not one of the shawl sources." });
      continue;
    }
    if (shawl.images.length === 0) {
      rows.push({
        source,
        action: "skip",
        reason: shawl.notes[0] ?? "No supported images were found in this shawl folder.",
      });
      continue;
    }
    const category = matchCategory(definition, input.categories);
    if (category === "ambiguous") {
      rows.push({ source, action: "missing-category", reason: "More than one category matches this folder." });
      continue;
    }
    if (!category) {
      rows.push({
        source,
        action: "missing-category",
        reason: `No category matches ${definition.directory}. Create that category in the admin before importing these shawls.`,
      });
      continue;
    }
    if (pricePaise === null) {
      rows.push({ source, action: "skip", reason: "The import price could not be converted to paise." });
      continue;
    }
    const name = displayName(shawl.folderName);
    const slug = importSlug(category.slug, shawl.folderName);
    const sku = importSku(category.slug, shawl.folderName);
    const ordered = [...shawl.images].sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
    const selected = ordered.slice(0, MAX_PRODUCT_IMAGES);
    const omittedImages = ordered.slice(MAX_PRODUCT_IMAGES).map((image) => image.relativePath);
    const draft: ImportDraft = {
      name,
      slug,
      sku,
      description: importDescription(name, category.name),
      category: category.slug,
      categoryName: category.name,
      pricePaise,
      stockQuantity: IMPORT_STOCK_QUANTITY,
      status: "draft",
      active: false,
      featured: false,
      currency: "INR",
      images: selected.map((image, index) => ({
        url: image.url,
        alt: `${name}, ${category.name}, photograph ${index + 1}.`,
        primary: index === 0,
      })),
      omittedImages,
    };
    if (draft.images.some((image) => image.url.length > 500 || image.alt.length > 300)) {
      rows.push({ source, action: "skip", reason: "An image address or description is too long for the catalogue." });
      continue;
    }
    if (seenSlugs.has(slug) || seenSkus.has(sku)) {
      rows.push({ source, action: "conflict", reason: "Another shawl in this import already uses this slug or SKU.", draft });
      continue;
    }
    seenSlugs.add(slug);
    seenSkus.add(sku);
    const extra =
      omittedImages.length > 0
        ? ` ${omittedImages.length} ${omittedImages.length === 1 ? "image exceeds" : "images exceed"} the ${MAX_PRODUCT_IMAGES}-image limit and would be left out.`
        : "";
    const bySku = input.products.find((product) => product.sku === sku);
    const bySlug = input.products.find((product) => product.slug === slug);
    if (bySku && bySlug && bySku.sku === bySlug.sku) {
      const owned = bySku;
      if (!sameImageUrls(owned.imageUrls, draft)) {
        const kept = owned.status ? ` It is currently ${owned.status}.` : "";
        rows.push({
          source,
          action: input.update ? "update" : "images-incomplete",
          reason: input.update
            ? `Would replace the image array only.${kept} Name, description, price, stock, and publication status would stay as saved.${extra}`
            : `The image array is missing photographs from this folder.${kept} Pass --update to replace the images only. Other saved fields would stay unchanged.${extra}`,
          draft,
        });
        continue;
      }
      rows.push({
        source,
        action: "already-imported",
        reason: "Already imported. The existing product was left unchanged.",
        draft,
      });
      continue;
    }
    if (bySku || bySlug) {
      rows.push({
        source,
        action: "conflict",
        reason: "A different product already uses this slug or SKU. It was left unchanged.",
        draft,
      });
      continue;
    }
    rows.push({ source, action: "create", reason: `Would create a draft.${extra}`, draft });
  }
  return rows;
}
