import "server-only";

import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/lib/models/order";
import { isPublicReference } from "@/lib/orders/reference";
import type { FulfilmentStatus } from "@/lib/orders/status";
import { isPaymentStatus, type PaymentStatus } from "@/lib/payments/status";

export const CUSTOMER_ORDER_PAGE_SIZE = 10;

export type OwnedOrderSummary = {
  reference: string;
  createdAt: string;
  totalPaise: number;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  itemCount: number;
};

export type OwnedOrderDetail = OwnedOrderSummary & {
  lines: Array<{ name: string; quantity: number }>;
};

export async function listOwnedOrders(
  customerId: string,
  page: number,
): Promise<{ orders: OwnedOrderSummary[]; page: number; pageCount: number }> {
  if (!isValidObjectId(customerId)) {
    return { orders: [], page: 1, pageCount: 1 };
  }
  await connectToDatabase();
  const filter = { customerId };
  const total = await Order.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / CUSTOMER_ORDER_PAGE_SIZE));
  const current = Number.isInteger(page) && page > 0 && page <= pageCount ? page : 1;
  const docs = await Order.find(filter)
    .select("publicReference createdAt totalPaise paymentStatus fulfilmentStatus lines.quantity")
    .sort({ createdAt: -1 })
    .skip((current - 1) * CUSTOMER_ORDER_PAGE_SIZE)
    .limit(CUSTOMER_ORDER_PAGE_SIZE)
    .lean<
      Array<{
        publicReference: string;
        createdAt?: Date;
        totalPaise: number;
        paymentStatus: string;
        fulfilmentStatus: FulfilmentStatus;
        lines?: { quantity?: number }[];
      }>
    >();
  return {
    orders: docs.flatMap((order) => {
      if (!isPaymentStatus(order.paymentStatus)) {
        return [];
      }
      return [
        {
          reference: order.publicReference,
          createdAt: order.createdAt ? order.createdAt.toISOString() : "",
          totalPaise: order.totalPaise,
          paymentStatus: order.paymentStatus,
          fulfilmentStatus: order.fulfilmentStatus,
          itemCount: (order.lines ?? []).reduce((sum, line) => sum + (line.quantity ?? 0), 0),
        },
      ];
    }),
    page: current,
    pageCount,
  };
}

export async function readOwnedOrder(customerId: string, reference: string): Promise<OwnedOrderDetail | null> {
  if (!isValidObjectId(customerId) || !isPublicReference(reference)) {
    return null;
  }
  await connectToDatabase();
  const order = await Order.findOne({ customerId, publicReference: reference })
    .select("publicReference createdAt totalPaise paymentStatus fulfilmentStatus lines.name lines.quantity")
    .lean<{
      publicReference: string;
      createdAt?: Date;
      totalPaise: number;
      paymentStatus: string;
      fulfilmentStatus: FulfilmentStatus;
      lines: { name: string; quantity: number }[];
    } | null>();
  if (!order || !isPaymentStatus(order.paymentStatus)) {
    return null;
  }
  return {
    reference: order.publicReference,
    createdAt: order.createdAt ? order.createdAt.toISOString() : "",
    totalPaise: order.totalPaise,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    lines: order.lines.map((line) => ({ name: line.name, quantity: line.quantity })),
  };
}
