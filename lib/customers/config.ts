export function readAppUrl(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.APP_URL?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) {
    return null;
  }
  return url.origin;
}

export function readGoogleConfig(env: Record<string, string | undefined> = process.env): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const origin = readAppUrl(env);
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!origin || clientId.length < 8 || clientSecret.length < 8) {
    return null;
  }
  if (clientId.startsWith("http") || /[\r\n]/.test(clientId) || /[\r\n]/.test(clientSecret)) {
    return null;
  }
  return { clientId, clientSecret, redirectUri: `${origin}/auth/callback/google` };
}

export function readEmailFrom(env: Record<string, string | undefined> = process.env): string | null {
  const from = env.EMAIL_FROM?.trim() ?? "";
  if (from.length < 6 || from.length > 200 || /[\r\n]/.test(from)) {
    return null;
  }
  return from;
}
