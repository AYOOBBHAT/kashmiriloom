import "server-only";

import mongoose, { type Model, Schema, type Types } from "mongoose";
import { MAX_BAG_QUANTITY } from "@/lib/bag";
import { INDIAN_STATES } from "@/lib/orders/address";
import { FULFILMENT_STATUSES, type FulfilmentStatus } from "@/lib/orders/status";
import { MAX_PAISE } from "@/lib/money";
import { isVerifiedPayment } from "@/lib/payments/verified";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/payments/status";

export type { FulfilmentStatus } from "@/lib/orders/status";
export type { PaymentStatus };

export interface OrderLineRecord {
  productId: Types.ObjectId;
  name: string;
  sku: string;
  slug: string;
  quantity: number;
  unitPricePaise: number;
}

export interface OrderAttrs {
  publicReference: string;
  idempotencyKey: string;
  fingerprint: string;
  viewTokenHash: string;
  lines: OrderLineRecord[];
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: "IN";
  };
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: "INR";
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentExpiresAt: Date;
  customerId?: Types.ObjectId;
}

function isWholePaise(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PAISE;
}

const lineSchema = new Schema<OrderLineRecord>(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: "Product" },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, trim: true, maxlength: 80 },
    quantity: { type: Number, required: true, min: 1, max: MAX_BAG_QUANTITY },
    unitPricePaise: {
      type: Number,
      required: true,
      validate: { validator: isWholePaise, message: "Unit price must be a whole number of paise." },
    },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderAttrs>(
  {
    publicReference: { type: String, required: true, unique: true, trim: true, maxlength: 24 },
    idempotencyKey: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 36 },
    fingerprint: { type: String, required: true, trim: true, maxlength: 64 },
    viewTokenHash: { type: String, required: true, select: false, trim: true, maxlength: 64 },
    lines: {
      type: [lineSchema],
      required: true,
      validate: {
        validator(value: OrderLineRecord[]) {
          return Array.isArray(value) && value.length > 0 && value.length <= 8;
        },
        message: "An order needs between 1 and 8 shawls.",
      },
    },
    contact: {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
      phone: { type: String, required: true, trim: true, maxlength: 10 },
    },
    address: {
      line1: { type: String, required: true, trim: true, maxlength: 120 },
      line2: { type: String, trim: true, maxlength: 120, default: "" },
      city: { type: String, required: true, trim: true, maxlength: 60 },
      state: { type: String, required: true, enum: INDIAN_STATES },
      postalCode: { type: String, required: true, trim: true, maxlength: 6 },
      country: { type: String, required: true, enum: ["IN"], default: "IN" },
    },
    subtotalPaise: {
      type: Number,
      required: true,
      validate: { validator: isWholePaise, message: "Subtotal must be a whole number of paise." },
    },
    shippingPaise: {
      type: Number,
      required: true,
      validate: { validator: isWholePaise, message: "Shipping must be a whole number of paise." },
    },
    taxPaise: {
      type: Number,
      required: true,
      validate: { validator: isWholePaise, message: "Tax must be a whole number of paise." },
    },
    totalPaise: {
      type: Number,
      required: true,
      validate: { validator: isWholePaise, message: "Total must be a whole number of paise." },
    },
    currency: { type: String, required: true, enum: ["INR"], default: "INR" },
    paymentStatus: { type: String, required: true, enum: PAYMENT_STATUSES, default: "pending" },
    razorpayOrderId: { type: String, trim: true, match: /^order_[A-Za-z0-9]+$/ },
    razorpayPaymentId: { type: String, trim: true, match: /^pay_[A-Za-z0-9]+$/ },
    paymentExpiresAt: { type: Date, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    fulfilmentStatus: {
      type: String,
      required: true,
      enum: FULFILMENT_STATUSES,
      default: "pending",
    },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ fulfilmentStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
orderSchema.index({ customerId: 1, createdAt: -1 });

function blocksPaymentChange(update: unknown): boolean {
  if (!update || typeof update !== "object") {
    return false;
  }
  const record = update as Record<string, unknown>;
  if ("paymentStatus" in record && record.paymentStatus !== "pending") {
    return true;
  }
  const set = record.$set;
  return Boolean(
    set &&
      typeof set === "object" &&
      "paymentStatus" in set &&
      (set as { paymentStatus?: unknown }).paymentStatus !== "pending",
  );
}

function rejectPaymentChange(this: mongoose.Query<unknown, unknown>) {
  if (blocksPaymentChange(this.getUpdate()) && !isVerifiedPayment()) {
    throw new Error("Payment status stays pending until a verified payment confirmation exists.");
  }
}

orderSchema.pre("updateOne", rejectPaymentChange);
orderSchema.pre("updateMany", rejectPaymentChange);
orderSchema.pre("findOneAndUpdate", rejectPaymentChange);
orderSchema.pre("replaceOne", rejectPaymentChange);

export const Order: Model<OrderAttrs> =
  (mongoose.models.Order as Model<OrderAttrs> | undefined) ?? mongoose.model<OrderAttrs>("Order", orderSchema);
