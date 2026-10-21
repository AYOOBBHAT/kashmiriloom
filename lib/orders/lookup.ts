import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { Order, type FulfilmentStatus } from "@/lib/models/order";
import { CHECKOUT_POLICY } from "@/lib/orders/charges";
import { isPublicReference, viewCookieGrants } from "@/lib/orders/reference";
import { isPaymentStatus, type PaymentStatus } from "@/lib/payments/status";

export type PublicOrderLine = {
  name: string;
  sku: string;
  slug: string;
  quantity: number;
  unitPricePaise: number;
};

export type PublicOrderContact = {
  name: string;
  email: string;
  phone: string;
};

export type PublicOrderAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

export type PublicOrder = {
  reference: string;
  lines: PublicOrderLine[];
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  paymentStatus: PaymentStatus;
  canPay: boolean;
  fulfilmentStatus: FulfilmentStatus;
  createdAt: string;
  contact: PublicOrderContact | null;
  address: PublicOrderAddress | null;
  shippingDetail: string;
  taxDetail: string;
  paymentDetail: string;
};

type OrderView = {
  publicReference: string;
  lines: PublicOrderLine[];
  contact: PublicOrderContact;
  address: PublicOrderAddress & { country?: string };
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  paymentStatus: string;
  fulfilmentStatus: FulfilmentStatus;
  createdAt?: Date;
  viewTokenHash?: string;
};

export async function readPublicOrder(
  reference: string,
  viewCookie: string | undefined,
): Promise<PublicOrder | null> {
  if (!isPublicReference(reference)) {
    return null;
  }
  await connectToDatabase();
  const order = await Order.findOne({ publicReference: reference })
    .select(
      "+viewTokenHash publicReference lines contact address subtotalPaise shippingPaise taxPaise totalPaise paymentStatus fulfilmentStatus createdAt",
    )
    .lean<OrderView | null>();
  if (!order || !isPaymentStatus(order.paymentStatus)) {
    return null;
  }
  const granted = viewCookieGrants(viewCookie, order.publicReference, order.viewTokenHash ?? "");
  return {
    reference: order.publicReference,
    lines: order.lines.map((line) => ({
      name: line.name,
      sku: line.sku,
      slug: line.slug,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
    })),
    subtotalPaise: order.subtotalPaise,
    shippingPaise: order.shippingPaise,
    taxPaise: order.taxPaise,
    totalPaise: order.totalPaise,
    paymentStatus: order.paymentStatus,
    canPay: (order.paymentStatus === "pending" || order.paymentStatus === "failed") && order.fulfilmentStatus !== "cancelled",
    fulfilmentStatus: order.fulfilmentStatus,
    createdAt: order.createdAt ? order.createdAt.toISOString() : "",
    contact: granted ? { name: order.contact.name, email: order.contact.email, phone: order.contact.phone } : null,
    address: granted
      ? {
          line1: order.address.line1,
          line2: order.address.line2 ?? "",
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
        }
      : null,
    shippingDetail: CHECKOUT_POLICY.shippingDetail,
    taxDetail: CHECKOUT_POLICY.taxDetail,
    paymentDetail: CHECKOUT_POLICY.paymentDetail,
  };
}
