import { isPublicReference } from "@/lib/orders/reference";

export function authRedirectUrl(origin: string | null, path: string): string {
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/login?error=failed";
  if (!origin) {
    return safe;
  }
  return new URL(safe, origin).toString();
}

export function safeNextPath(value: unknown): string {
  if (value === "/account" || value === "/account/orders" || value === "/checkout") {
    return value;
  }
  if (typeof value === "string" && value.startsWith("/account/orders/")) {
    const reference = value.slice("/account/orders/".length);
    if (isPublicReference(reference)) {
      return `/account/orders/${reference}`;
    }
  }
  return "/account";
}
