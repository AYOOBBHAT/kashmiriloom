import "server-only";

import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/lib/models/customer";
import { normalizeEmail } from "@/lib/customers/email";
import { openCustomerSession } from "@/lib/customers/sessions";

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleIdentityClaims = {
  sub?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  audience?: unknown;
  issuer?: unknown;
  expiresAt?: unknown;
  name?: unknown;
};

export function googleClaimsAreTrusted(
  claims: GoogleIdentityClaims,
  clientId: string,
  now = Date.now(),
): { ok: true; sub: string; email: string; name: string } | { ok: false } {
  const sub = typeof claims.sub === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(claims.sub) ? claims.sub : "";
  const email = normalizeEmail(claims.email);
  const issuer = typeof claims.issuer === "string" ? claims.issuer : "";
  const expiresAt = typeof claims.expiresAt === "number" ? claims.expiresAt : 0;
  const audience = claims.audience;
  const audienceMatches =
    audience === clientId || (Array.isArray(audience) && audience.length === 1 && audience[0] === clientId);
  if (!sub || !email || claims.emailVerified !== true || !GOOGLE_ISSUERS.has(issuer) || !audienceMatches || expiresAt * 1000 <= now) {
    return { ok: false };
  }
  const name = typeof claims.name === "string" && /^[\p{L}][\p{L} .'-]{1,79}$/u.test(claims.name.trim()) ? claims.name.trim() : "Customer";
  return { ok: true, sub, email, name };
}

export function readGoogleCallback(
  query: { error?: string | null; code?: string | null; state?: string | null },
  stored: { state?: string | null; verifier?: string | null },
): { ok: true; code: string; verifier: string } | { ok: false; code: "cancelled" | "failed" } {
  if (query.error === "access_denied") {
    return { ok: false, code: "cancelled" };
  }
  if (query.error || !query.code || !query.state || !stored.state || !stored.verifier || query.state !== stored.state) {
    return { ok: false, code: "failed" };
  }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(query.code) || !/^[A-Za-z0-9_-]{43,128}$/.test(stored.verifier)) {
    return { ok: false, code: "failed" };
  }
  return { ok: true, code: query.code, verifier: stored.verifier };
}

export function googleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
}): URL {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", codeChallenge(input.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleAuthorizationCode(
  input: {
    code: string;
    codeVerifier: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { id_token?: unknown };
  return typeof payload.id_token === "string" && payload.id_token.length > 20 ? payload.id_token : null;
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  now = Date.now(),
): Promise<{ ok: true; sub: string; email: string; name: string } | { ok: false }> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });
    return googleClaimsAreTrusted(
      {
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        audience: payload.aud,
        issuer: payload.iss,
        expiresAt: payload.exp,
        name: payload.name,
      },
      clientId,
      now,
    );
  } catch {
    return { ok: false };
  }
}

export async function signInWithGoogleIdentity(
  claims: GoogleIdentityClaims,
  context: { clientId: string; now?: number; currentCustomerId?: string | null; link?: boolean },
): Promise<{ ok: true; token: string; customerId: string } | { ok: false; code: "rejected" | "link" }> {
  const now = context.now ?? Date.now();
  const trusted = googleClaimsAreTrusted(claims, context.clientId, now);
  if (!trusted.ok) {
    return { ok: false, code: "rejected" };
  }
  await connectToDatabase();
  if (context.link && context.currentCustomerId) {
    const linked = await linkGoogleIdentity(context.currentCustomerId, trusted);
    if (!linked) {
      return { ok: false, code: "link" };
    }
    const token = await openCustomerSession(linked, now);
    return token ? { ok: true, token, customerId: linked } : { ok: false, code: "rejected" };
  }
  const existingBySub = await Customer.findOne({ googleSub: trusted.sub }).select("_id").lean<{ _id: { toString(): string } } | null>();
  if (existingBySub) {
    const token = await openCustomerSession(existingBySub._id.toString(), now);
    return token ? { ok: true, token, customerId: existingBySub._id.toString() } : { ok: false, code: "rejected" };
  }
  const existingByEmail = await Customer.findOne({ email: trusted.email }).select("googleSub").lean<{ googleSub?: string } | null>();
  if (existingByEmail) {
    return { ok: false, code: "link" };
  }
  try {
    const created = await Customer.create({
      email: trusted.email,
      name: trusted.name,
      emailVerified: true,
      googleSub: trusted.sub,
      sessionVersion: 0,
    });
    const token = await openCustomerSession(created.id, now);
    return token ? { ok: true, token, customerId: created.id } : { ok: false, code: "rejected" };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const winner = await Customer.findOne({ googleSub: trusted.sub }).select("_id").lean<{ _id: { toString(): string } } | null>();
      if (!winner) {
        return { ok: false, code: "link" };
      }
      const token = await openCustomerSession(winner._id.toString(), now);
      return token ? { ok: true, token, customerId: winner._id.toString() } : { ok: false, code: "rejected" };
    }
    console.error(`Google sign-in failed: ${redactSecrets(error instanceof Error ? error.message : "Unknown error")}`);
    return { ok: false, code: "rejected" };
  }
}

async function linkGoogleIdentity(
  customerId: string,
  trusted: { sub: string; email: string },
): Promise<string | null> {
  const taken = await Customer.findOne({ googleSub: trusted.sub }).select("_id").lean<{ _id: { toString(): string } } | null>();
  if (taken && taken._id.toString() !== customerId) {
    return null;
  }
  const updated = await Customer.findOneAndUpdate(
    { _id: customerId, email: trusted.email, $or: [{ googleSub: { $exists: false } }, { googleSub: trusted.sub }] },
    { $set: { googleSub: trusted.sub, emailVerified: true } },
    { returnDocument: "after" },
  )
    .select("_id")
    .lean<{ _id: { toString(): string } } | null>();
  return updated ? updated._id.toString() : null;
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
