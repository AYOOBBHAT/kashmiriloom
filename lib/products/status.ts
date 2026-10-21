export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export function isProductStatus(value: string): value is ProductStatus {
  return PRODUCT_STATUSES.some((status) => status === value);
}

/** Legacy records stored only `active`. Draft exists only after an explicit save. */
export function statusFromRecord(status: unknown, active: boolean): ProductStatus {
  if (status === "draft" || status === "active" || status === "archived") {
    return status;
  }
  return active ? "active" : "archived";
}

export function activeForStatus(status: ProductStatus): boolean {
  return status === "active";
}
