export type CatalogueProblemCode = "missing-uri" | "unavailable";

export type CatalogueProblem = {
  code: CatalogueProblemCode;
  message: string;
};

export const MISSING_URI_MESSAGE =
  "MONGODB_URI is not set. Add it to .env.local in the project root, using .env.example as the shape, then restart the dev server.";

export const UNAVAILABLE_MESSAGE =
  "The catalogue database could not be reached. Check that the Atlas cluster is available and that MONGODB_URI in .env.local is correct. The connection string is not shown here.";

export class CatalogueAccessError extends Error {
  readonly code: CatalogueProblemCode;

  constructor(code: CatalogueProblemCode, message: string) {
    super(message);
    this.name = "CatalogueAccessError";
    this.code = code;
  }
}

export function redactSecrets(value: string): string {
  return value
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "mongodb://[redacted]")
    .replace(/MONGODB_URI\s*[=:]\s*\S+/gi, "MONGODB_URI=[redacted]")
    .replace(/ADMIN_PASSWORD\s*[=:]\s*\S+/gi, "ADMIN_PASSWORD=[redacted]")
    .replace(/ADMIN_SESSION_SECRET\s*[=:]\s*\S+/gi, "ADMIN_SESSION_SECRET=[redacted]")
    .replace(/CLOUDINARY_API_SECRET\s*[=:]\s*\S+/gi, "CLOUDINARY_API_SECRET=[redacted]")
    .replace(/CLOUDINARY_API_KEY\s*[=:]\s*\S+/gi, "CLOUDINARY_API_KEY=[redacted]")
    .replace(/RAZORPAY_KEY_SECRET\s*[=:]\s*\S+/gi, "RAZORPAY_KEY_SECRET=[redacted]")
    .replace(/RAZORPAY_WEBHOOK_SECRET\s*[=:]\s*\S+/gi, "RAZORPAY_WEBHOOK_SECRET=[redacted]")
    .replace(/RAZORPAY_KEY_ID\s*[=:]\s*\S+/gi, "RAZORPAY_KEY_ID=[redacted]")
    .replace(/RESEND_API_KEY\s*[=:]\s*\S+/gi, "RESEND_API_KEY=[redacted]")
    .replace(/GOOGLE_CLIENT_SECRET\s*[=:]\s*\S+/gi, "GOOGLE_CLIENT_SECRET=[redacted]")
    .replace(/GOOGLE_CLIENT_ID\s*[=:]\s*\S+/gi, "GOOGLE_CLIENT_ID=[redacted]")
    .replace(/UPSTASH_REDIS_REST_TOKEN\s*[=:]\s*\S+/gi, "UPSTASH_REDIS_REST_TOKEN=[redacted]")
    .replace(/UPSTASH_REDIS_REST_URL\s*[=:]\s*\S+/gi, "UPSTASH_REDIS_REST_URL=[redacted]")
    .replace(/token=[A-Za-z0-9_-]+/g, "token=[redacted]");
}

export function toProblem(error: CatalogueAccessError): CatalogueProblem {
  return { code: error.code, message: error.message };
}
