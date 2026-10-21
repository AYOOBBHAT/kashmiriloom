import "server-only";

import mongoose, { type Model, Schema, type Types } from "mongoose";

export interface PasswordResetAttrs {
  tokenHash: string;
  customerId: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
}

const passwordResetSchema = new Schema<PasswordResetAttrs>(
  {
    tokenHash: { type: String, required: true, unique: true, maxlength: 64 },
    customerId: { type: Schema.Types.ObjectId, required: true, ref: "Customer", index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PasswordReset: Model<PasswordResetAttrs> =
  (mongoose.models.PasswordReset as Model<PasswordResetAttrs> | undefined) ??
  mongoose.model<PasswordResetAttrs>("PasswordReset", passwordResetSchema);
