import "server-only";

import mongoose, { type Model, Schema } from "mongoose";

export interface CategoryAttrs {
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  active: boolean;
  displayOrder: number;
  previousSlugs: string[];
}

const categorySchema = new Schema<CategoryAttrs>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 80,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    imageUrl: { type: String, trim: true, maxlength: 500 },
    imageAlt: { type: String, trim: true, maxlength: 300 },
    active: { type: Boolean, required: true, default: true },
    displayOrder: { type: Number, required: true, min: 0, max: 10_000, default: 0 },
    previousSlugs: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 80 }],
      default: undefined,
    },
  },
  { timestamps: true },
);

categorySchema.index({ active: 1, displayOrder: 1, name: 1 });
categorySchema.index({ previousSlugs: 1 });

export const Category: Model<CategoryAttrs> =
  (mongoose.models.Category as Model<CategoryAttrs> | undefined) ??
  mongoose.model<CategoryAttrs>("Category", categorySchema);
