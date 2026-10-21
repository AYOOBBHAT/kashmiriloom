export const ORDER_VIEW_COOKIE = "kashmiriloom-order-view";
const FOURTEEN_DAYS = 60 * 60 * 24 * 14;

export function orderViewCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/orders",
    maxAge: FOURTEEN_DAYS,
  };
}

export function packViewCookie(reference: string, token: string): string {
  return `${reference}.${token}`;
}
