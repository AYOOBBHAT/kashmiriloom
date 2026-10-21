import "server-only";

import mongoose, { type Model, Schema } from "mongoose";

export interface CustomerAttrs {
  email: string;
  name: string;
  passwordHash?: string;
  emailVerified: boolean;
  googleSub?: string;
  sessionVersion: number;
}

const customerSchema = new Schema<CustomerAttrs>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, required: true, default: false },
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 255,
      match: /^[A-Za-z0-9_-]+$/,
    },
    sessionVersion: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const Customer: Model<CustomerAttrs> =
  (mongoose.models.Customer as Model<CustomerAttrs> | undefined) ??
  mongoose.model<CustomerAttrs>("Customer", customerSchema);
