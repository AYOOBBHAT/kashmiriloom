import "server-only";

import { getCurrentAdmin } from "@/lib/auth/session";
import { AdminAccessError } from "@/lib/products/admin-repository";
import { connectToDatabase } from "@/lib/mongodb";
import { Order, type FulfilmentStatus } from "@/lib/models/order";
import { commitFulfilmentChange, type FulfilmentResult } from "@/lib/orders/fulfilment";
import { isPublicReference } from "@/lib/orders/reference";
import { isPaymentStatus, type PaymentStatus } from "@/lib/payments/status";

export const ORDER_PAGE_SIZE = 10;

export type AdminOrderLine = {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  quantity: number;
  unitPricePaise: number;
};

export type AdminOrderSummary = {
  reference: string;
  name: string;
  totalPaise: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  createdAt: string;
  itemCount: number;
};

export type AdminOrderDetail = AdminOrderSummary & {
  razorpayOrderId: string | null;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  lines: AdminOrderLine[];
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
};

export type AdminOrderList = {
  orders: AdminOrderSummary[];
  page: number;
  pageCount: number;
  total: number;
};

export type OrderCounts = {
  total: number;
  pendingPayment: number;
  openFulfilment: number;
};

type StoredSummary = {
  publicReference: string;
  contact?: { name?: string };
  totalPaise: number;
  paymentStatus: string;
  fulfilmentStatus: FulfilmentStatus;
  createdAt?: Date;
  lines?: { quantity?: number }[];
};

const summaryFields = "publicReference contact.name totalPaise paymentStatus fulfilmentStatus createdAt lines.quantity";

export async function countOrders(): Promise<OrderCounts> {
  await authorize();
  await connectToDatabase();
  const [total, pendingPayment, openFulfilment] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ paymentStatus: { $in: ["pending", "processing", "failed"] } }),
    Order.countDocuments({ fulfilmentStatus: { $in: ["pending", "processing"] } }),
  ]);
  return { total, pendingPayment, openFulfilment };
}

export async function listAdminOrders(search: string, status: string, page: number): Promise<AdminOrderList> {
  await authorize();
  await connectToDatabase();
  const filter: { publicReference?: { $regex: string }; fulfilmentStatus?: FulfilmentStatus } = {};
  const reference = search.trim().toUpperCase();
  if (reference) {
    if (!/^KL-[A-Z2-9]{0,16}$/.test(reference) && reference !== "KL") {
      return { orders: [], page: 1, pageCount: 1, total: 0 };
    }
    filter.publicReference = { $regex: `^${escapeRegex(reference)}` };
  }
  if (status === "pending" || status === "processing" || status === "shipped" || status === "delivered" || status === "cancelled") {
    filter.fulfilmentStatus = status;
  }
  const safePage = Number.isInteger(page) && page > 0 && page <= 1000 ? page : 1;
  const total = await Order.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));
  const current = Math.min(safePage, pageCount);
  const docs = await Order.find(filter)
    .select(summaryFields)
    .sort({ createdAt: -1 })
    .skip((current - 1) * ORDER_PAGE_SIZE)
    .limit(ORDER_PAGE_SIZE)
    .lean<StoredSummary[]>();
  return {
    orders: docs.map(toSummary),
    page: current,
    pageCount,
    total,
  };
}

export async function readAdminOrder(reference: string): Promise<AdminOrderDetail | null> {
  await authorize();
  if (!isPublicReference(reference)) {
    return null;
  }
  await connectToDatabase();
  const order = await Order.findOne({ publicReference: reference })
    .select(
      "publicReference contact address lines subtotalPaise shippingPaise taxPaise totalPaise paymentStatus fulfilmentStatus razorpayOrderId createdAt",
    )
    .lean<{
      publicReference: string;
      contact: { name: string; email: string; phone: string };
      address: { line1: string; line2?: string; city: string; state: string; postalCode: string };
      lines: AdminOrderLine[];
      subtotalPaise: number;
      shippingPaise: number;
      taxPaise: number;
      totalPaise: number;
      paymentStatus: string;
      razorpayOrderId?: string;
      fulfilmentStatus: FulfilmentStatus;
      createdAt?: Date;
    } | null>();
  if (!order) {
    return null;
  }
  return {
    ...toSummary(order),
    razorpayOrderId: order.razorpayOrderId ?? null,
    email: order.contact.email,
    phone: order.contact.phone,
    address: {
      line1: order.address.line1,
      line2: order.address.line2 ?? "",
      city: order.address.city,
      state: order.address.state,
      postalCode: order.address.postalCode,
    },
    lines: order.lines.map((line) => ({
      productId: String(line.productId),
      name: line.name,
      sku: line.sku,
      slug: line.slug,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
    })),
    subtotalPaise: order.subtotalPaise,
    shippingPaise: order.shippingPaise,
    taxPaise: order.taxPaise,
  };
}

export async function updateOrderFulfilment(reference: string, status: unknown): Promise<FulfilmentResult> {
  await authorize();
  return commitFulfilmentChange(reference, status);
}

async function authorize() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new AdminAccessError();
  }
}

function toSummary(order: StoredSummary): AdminOrderSummary {
  return {
    reference: order.publicReference,
    name: order.contact?.name ?? "Guest",
    totalPaise: order.totalPaise,
    paymentStatus: isPaymentStatus(order.paymentStatus) ? order.paymentStatus : "pending",
    fulfilmentStatus: order.fulfilmentStatus,
    createdAt: order.createdAt ? order.createdAt.toISOString() : "",
    itemCount: (order.lines ?? []).reduce((sum, line) => sum + (line.quantity ?? 0), 0),
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
