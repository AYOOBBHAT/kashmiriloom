import "server-only";

import mongoose, { type Model, Schema } from "mongoose";
import type { CollectionId } from "@/data/catalog";
import { MAX_PAISE } from "@/lib/money";

export interface ProductImageRecord {
  url: string;
  alt: string;
}

export interface ProductAttrs {
  name: string;
  slug: string;
  description: string;
  category: CollectionId;
  pricePaise: number;
  compareAtPricePaise?: number;
  images: ProductImageRecord[];
  sku: string;
  stockQuantity: number;
  active: boolean;
  featured: boolean;
  currency: "INR";
  material?: string;
  dimensions?: string;
  care?: string;
}

const CATEGORIES: CollectionId[] = ["kani", "embroidered", "everyday"];

function isWholePaise(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PAISE;
}

const imageSchema = new Schema<ProductImageRecord>(
  {
    url: { type: String, required: true, trim: true, maxlength: 500 },
    alt: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const productSchema = new Schema<ProductAttrs>(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 80,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    category: { type: String, required: true, enum: CATEGORIES },
    pricePaise: {
      type: Number,
      required: true,
      validate: {
        validator: isWholePaise,
        message: "Price must be a whole number of paise.",
      },
    },
    compareAtPricePaise: {
      type: Number,
      validate: {
        validator(this: ProductAttrs, value: number | null | undefined) {
          if (value == null) {
            return true;
          }
          return isWholePaise(value) && value > this.pricePaise;
        },
        message: "Compare-at price must be a whole number of paise above the selling price.",
      },
    },
    images: {
      type: [imageSchema],
      required: true,
      validate: {
        validator(value: ProductImageRecord[]) {
          return Array.isArray(value) && value.length > 0 && value.length <= 6;
        },
        message: "A product needs between 1 and 6 images.",
      },
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
      match: /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
      max: 100_000,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number.",
      },
    },
    active: { type: Boolean, required: true, default: true },
    featured: { type: Boolean, required: true, default: false },
    currency: { type: String, required: true, enum: ["INR"], default: "INR" },
    material: { type: String, trim: true, maxlength: 200 },
    dimensions: { type: String, trim: true, maxlength: 200 },
    care: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

productSchema.index({ active: 1, category: 1, createdAt: 1 });
productSchema.index({ active: 1, featured: 1, createdAt: 1 });
productSchema.index({ updatedAt: -1 });
productSchema.index({ stockQuantity: 1, name: 1 });

export const Product: Model<ProductAttrs> =
  (mongoose.models.Product as Model<ProductAttrs> | undefined) ??
  mongoose.model<ProductAttrs>("Product", productSchema);
