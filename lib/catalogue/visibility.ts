import type { SaveKind } from "@/lib/catalogue/form-feedback";
import type { ProductStatus } from "@/lib/products/status";
import { activeForStatus } from "@/lib/products/status";

export function categoryShownPublicly(active: boolean): boolean {
  return active;
}

export function productShownPublicly(status: ProductStatus): boolean {
  return activeForStatus(status);
}

export function categorySaveNotice(active: boolean, kind: SaveKind): string {
  const lead = kind === "created" ? "Category created successfully." : "Category updated successfully.";
  if (active) {
    return `${lead} This category is active and appears in public category listings.`;
  }
  return `${lead} This category is inactive and is hidden from public category listings.`;
}

export function productSaveNotice(status: ProductStatus, kind: SaveKind): string {
  const lead = kind === "created" ? "Product created successfully." : "Product updated successfully.";
  if (status === "draft") {
    return `${lead} It was saved as a draft and is not visible in the public shop.`;
  }
  if (status === "active") {
    return `${lead} It is published and available in the shop. It appears in the homepage edit only when Featured is checked.`;
  }
  return `${lead} It is archived and hidden from the public shop.`;
}
