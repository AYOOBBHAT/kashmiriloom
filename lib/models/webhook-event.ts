import "server-only";

import mongoose, { type Model, Schema } from "mongoose";

export interface WebhookEventAttrs {
  eventId: string;
  eventName: string;
}

const webhookEventSchema = new Schema<WebhookEventAttrs>(
  {
    eventId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    eventName: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const WebhookEvent: Model<WebhookEventAttrs> =
  (mongoose.models.WebhookEvent as Model<WebhookEventAttrs> | undefined) ??
  mongoose.model<WebhookEventAttrs>("WebhookEvent", webhookEventSchema);
