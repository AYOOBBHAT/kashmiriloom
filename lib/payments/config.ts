export type TestCheckoutConfig = {
  keyId: string;
  keySecret: string;
};

export type WebhookConfig = {
  secret: string;
};

export type CheckoutConfigResult =
  | { ok: true; config: TestCheckoutConfig }
  | { ok: false; code: "unconfigured" | "live-blocked"; message: string };

const LIVE_BLOCKED = "Live payments are turned off. This shop only opens Razorpay test checkout.";
const UNCONFIGURED =
  "Razorpay test checkout is not configured. The order can still be reserved, and it stays unpaid.";

export function readTestCheckoutConfig(env: Record<string, string | undefined> = process.env): CheckoutConfigResult {
  const mode = env.RAZORPAY_MODE?.trim() || "test";
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (mode !== "test" || keyId.startsWith("rzp_live_")) {
    return { ok: false, code: "live-blocked", message: LIVE_BLOCKED };
  }
  if (!keyId.startsWith("rzp_test_") || keySecret.length < 8 || keySecret.startsWith("rzp_live_")) {
    return { ok: false, code: "unconfigured", message: UNCONFIGURED };
  }
  return { ok: true, config: { keyId, keySecret } };
}

export function readWebhookSecret(env: Record<string, string | undefined> = process.env): string | null {
  const mode = env.RAZORPAY_MODE?.trim() || "test";
  const secret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (mode !== "test" || secret.length < 8) {
    return null;
  }
  return secret;
}
