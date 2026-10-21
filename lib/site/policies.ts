export const STORE_NAME = "KashmiriLoom";
export const STORE_ORIGIN = "https://kashmiriloom.com";
export const PROPRIETOR_NAME = "Ayoob Bhat";
export const BUSINESS_DESCRIPTION = "individually operated";
export const BUSINESS_ADDRESS = "Handwara, Kupwara, Jammu and Kashmir, India";
export const SUPPORT_EMAIL = "support@kashmiriloom.com";
export const SUPPORT_PHONE_DISPLAY = "+91 95412 68502";

const SUPPORT_PHONE_DIGITS = "919541268502";

export const SUPPORT_PHONE_TEL = `+${SUPPORT_PHONE_DIGITS}`;
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_DIGITS}`;

export const policyLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy policy" },
  { href: "/terms-and-conditions", label: "Terms and conditions" },
  { href: "/shipping-policy", label: "Shipping policy" },
  { href: "/refund-policy", label: "Refund and cancellation policy" },
] as const;

export function policyUrl(path: (typeof policyLinks)[number]["href"]): string {
  return `${STORE_ORIGIN}${path}`;
}
