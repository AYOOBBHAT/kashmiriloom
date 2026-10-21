export const ADMIN_COOKIE_NAME = "kashmiriloom-admin";
/** Eight hours. iron-session also expires the cookie shortly before the seal. */
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
export const MIN_SESSION_SECRET_LENGTH = 32;

export function adminCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true as const,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    return null;
  }
  return secret;
}
