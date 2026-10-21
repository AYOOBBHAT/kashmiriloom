export const FULFILMENT_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export const fulfilmentLabels: Record<FulfilmentStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
