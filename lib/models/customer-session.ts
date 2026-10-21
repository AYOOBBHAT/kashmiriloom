import "server-only";

import mongoose, { type Model, Schema, type Types } from "mongoose";

export interface CustomerSessionAttrs {
  tokenHash: string;
  customerId: Types.ObjectId;
  sessionVersion: number;
  expiresAt: Date;
}

const customerSessionSchema = new Schema<CustomerSessionAttrs>(
  {
    tokenHash: { type: String, required: true, unique: true, maxlength: 64 },
    customerId: { type: Schema.Types.ObjectId, required: true, ref: "Customer", index: true },
    sessionVersion: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CustomerSession: Model<CustomerSessionAttrs> =
  (mongoose.models.CustomerSession as Model<CustomerSessionAttrs> | undefined) ??
  mongoose.model<CustomerSessionAttrs>("CustomerSession", customerSessionSchema);
