import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readAppUrl, readGoogleConfig } from "@/lib/customers/config";
import {
  CUSTOMER_COOKIE_NAME,
  GOOGLE_LINK_COOKIE,
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  customerCookieOptions,
  googleCookieOptions,
} from "@/lib/customers/cookie";
import { getCurrentCustomer } from "@/lib/customers/current";
import { exchangeGoogleAuthorizationCode, readGoogleCallback, signInWithGoogleIdentity, verifyGoogleIdToken } from "@/lib/customers/google";
import { authRedirectUrl, safeNextPath } from "@/lib/customers/paths";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const stored = jar.get(GOOGLE_STATE_COOKIE)?.value ?? "";
  const dot = stored.indexOf(".");
  const parsed = readGoogleCallback(
    {
      error: url.searchParams.get("error"),
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
    },
    { state: dot === -1 ? "" : stored.slice(0, dot), verifier: dot === -1 ? "" : stored.slice(dot + 1) },
  );
  const link = jar.get(GOOGLE_LINK_COOKIE)?.value === "1";
  const nextPath = safeNextPath(jar.get(GOOGLE_NEXT_COOKIE)?.value);
  const origin = readAppUrl();
  if (!parsed.ok) {
    return finish(origin, `/login?error=${parsed.code}`);
  }
  const config = readGoogleConfig();
  if (!config) {
    return finish(origin, "/login?error=failed");
  }
  const idToken = await exchangeGoogleAuthorizationCode({
    code: parsed.code,
    codeVerifier: parsed.verifier,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
  if (!idToken) {
    return finish(origin, "/login?error=failed");
  }
  const verified = await verifyGoogleIdToken(idToken, config.clientId);
  if (!verified.ok) {
    return finish(origin, "/login?error=failed");
  }
  const current = link ? await getCurrentCustomer() : null;
  const signedIn = await signInWithGoogleIdentity(
    {
      sub: verified.sub,
      email: verified.email,
      emailVerified: true,
      audience: config.clientId,
      issuer: "https://accounts.google.com",
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      name: verified.name,
    },
    { clientId: config.clientId, currentCustomerId: current?.id, link },
  );
  if (!signedIn.ok) {
    return finish(origin, `/login?error=${signedIn.code === "link" ? "link" : "failed"}`);
  }
  const response = redirectTo(origin, nextPath);
  clearGoogleCookies(response);
  response.cookies.set(CUSTOMER_COOKIE_NAME, signedIn.token, customerCookieOptions(process.env.NODE_ENV));
  return response;
}

function finish(origin: string | null, path: string) {
  const response = redirectTo(origin, path);
  clearGoogleCookies(response);
  return response;
}

function redirectTo(origin: string | null, path: string) {
  const location = authRedirectUrl(origin, path);
  const response = location.startsWith("http")
    ? NextResponse.redirect(location)
    : new NextResponse(null, { status: 303, headers: { Location: location } });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function clearGoogleCookies(response: NextResponse) {
  const options = { ...googleCookieOptions(process.env.NODE_ENV), maxAge: 0 };
  response.cookies.set(GOOGLE_STATE_COOKIE, "", options);
  response.cookies.set(GOOGLE_NEXT_COOKIE, "", options);
  response.cookies.set(GOOGLE_LINK_COOKIE, "", options);
}
