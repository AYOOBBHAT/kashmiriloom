import "server-only";

import mongoose, { type Model, Schema } from "mongoose";

export interface AdminAttrs {
  email: string;
  passwordHash: string;
}

const adminSchema = new Schema<AdminAttrs>(
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
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export const Admin: Model<AdminAttrs> =
  (mongoose.models.Admin as Model<AdminAttrs> | undefined) ??
  mongoose.model<AdminAttrs>("Admin", adminSchema);
