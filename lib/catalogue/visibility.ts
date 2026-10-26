import type { ProductStatus } from "@/lib/products/status";
import { activeForStatus } from "@/lib/products/status";

export function categoryShownPublicly(active: boolean): boolean {
  return active;
}

export function productShownPublicly(status: ProductStatus): boolean {
  return activeForStatus(status);
}

export function categorySaveNotice(active: boolean): string {
  if (active) {
    return "Saved. This category is in the admin list and is shown on the homepage, in navigation, in the shop, and in the footer.";
  }
  return "Saved. This category is in the admin list and stays off the shop until it is marked active.";
}

export function productSaveNotice(status: ProductStatus): string {
  if (status === "active") {
    return "Saved. This shawl is active. It appears in the shop and in its collection. It appears in the homepage edit only when Featured is checked.";
  }
  if (status === "draft") {
    return "Saved. This draft is in the admin list and stays off the shop until the status is Active.";
  }
  return "Saved. This shawl is archived and hidden from the shop. The record stays, including any past orders.";
}
