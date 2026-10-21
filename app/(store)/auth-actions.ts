"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { clientAddress } from "@/lib/auth/rate-limit";
import { loginCustomer, registerCustomer, requestPasswordReset, resetCustomerPassword } from "@/lib/customers/accounts";
import { readAppUrl, readGoogleConfig } from "@/lib/customers/config";
import {
  CUSTOMER_COOKIE_NAME,
  GOOGLE_LINK_COOKIE,
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  customerCookieOptions,
  googleCookieOptions,
} from "@/lib/customers/cookie";
import { googleAuthorizationUrl } from "@/lib/customers/google";
import { safeNextPath } from "@/lib/customers/paths";
import { createResendMailer } from "@/lib/customers/resend";
import { destroyCustomerSession, openCustomerSession } from "@/lib/customers/sessions";
import { createSecretToken } from "@/lib/customers/tokens";
import type { AuthFields } from "@/lib/customers/accounts";

export type AuthFormState = {
  message: string;
  fields: AuthFields;
};

export async function registerAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await connection();
  const result = await registerCustomer(
    { name: formData.get("name"), email: formData.get("email"), password: formData.get("password") },
    { ip: clientAddress(await headers()) },
  );
  if (!result.ok) {
    return { message: result.message, fields: result.fields };
  }
  const token = await openCustomerSession(result.customerId);
  if (!token) {
    return { message: "The account was created, but sign-in could not start. Sign in from the login page.", fields: {} };
  }
  await writeSession(token);
  redirect(safeNextPath(formData.get("next")));
}

export async function loginAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await connection();
  const result = await loginCustomer(
    { email: formData.get("email"), password: formData.get("password") },
    { ip: clientAddress(await headers()) },
  );
  if (!result.ok) {
    return { message: result.message, fields: {} };
  }
  await writeSession(result.token);
  redirect(safeNextPath(formData.get("next")));
}

export async function forgotPasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await connection();
  const result = await requestPasswordReset(formData.get("email"), {
    ip: clientAddress(await headers()),
    appUrl: readAppUrl(),
    mailer: createResendMailer(),
  });
  return { message: result.message, fields: {} };
}

export async function resetPasswordAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await connection();
  const result = await resetCustomerPassword(
    { token: formData.get("token"), password: formData.get("password") },
    { ip: clientAddress(await headers()) },
  );
  if (!result.ok) {
    return { message: result.message, fields: {} };
  }
  redirect("/login?reset=1");
}

export async function signOutAction(): Promise<void> {
  await connection();
  const jar = await cookies();
  await destroyCustomerSession(jar.get(CUSTOMER_COOKIE_NAME)?.value ?? "");
  jar.set(CUSTOMER_COOKIE_NAME, "", { ...customerCookieOptions(process.env.NODE_ENV), maxAge: 0 });
  redirect("/login");
}

export async function beginGoogleSignIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  await connection();
  const config = readGoogleConfig();
  if (!config) {
    return { message: "Google sign-in is not available right now.", fields: {} };
  }
  const state = createSecretToken();
  const verifier = createSecretToken();
  const jar = await cookies();
  const options = googleCookieOptions(process.env.NODE_ENV);
  jar.set(GOOGLE_STATE_COOKIE, `${state}.${verifier}`, options);
  jar.set(GOOGLE_NEXT_COOKIE, safeNextPath(formData.get("next")), options);
  if (formData.get("link") === "1") {
    jar.set(GOOGLE_LINK_COOKIE, "1", options);
  } else {
    jar.set(GOOGLE_LINK_COOKIE, "", { ...options, maxAge: 0 });
  }
  redirect(googleAuthorizationUrl({ ...config, state, codeVerifier: verifier }).toString());
}

async function writeSession(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE_NAME, token, customerCookieOptions(process.env.NODE_ENV));
}
