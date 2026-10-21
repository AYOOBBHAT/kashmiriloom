export const CUSTOMER_COOKIE_NAME = "kashmiriloom-customer";
export const GOOGLE_STATE_COOKIE = "kashmiriloom-google-state";
export const GOOGLE_NEXT_COOKIE = "kashmiriloom-google-next";
export const GOOGLE_LINK_COOKIE = "kashmiriloom-google-link";

export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
export const GOOGLE_COOKIE_TTL_SECONDS = 60 * 10;

export function customerCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true as const,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_SECONDS,
  };
}

export function googleCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true as const,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/auth/callback/google",
    maxAge: GOOGLE_COOKIE_TTL_SECONDS,
  };
}
