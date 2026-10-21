import "server-only";

import { isValidObjectId, type Types } from "mongoose";
import { redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/lib/models/customer";
import { PasswordReset } from "@/lib/models/password-reset";
import { CustomerSession } from "@/lib/models/customer-session";
import { normalizeEmail } from "@/lib/customers/email";
import { consumeLimit } from "@/lib/customers/limits";
import { customerAuthPolicy } from "@/lib/rate-limit/policy";
import { customerPasswordMatches, hashCustomerPassword, passwordError } from "@/lib/customers/password";
import { runOrderTransaction, transactionsUnsupported } from "@/lib/orders/transaction";
import { openCustomerSession } from "@/lib/customers/sessions";
import { createSecretToken, hashSecret } from "@/lib/customers/tokens";

const NAME = /^[\p{L}][\p{L} .'-]{1,79}$/u;
const RESET_MS = 30 * 60 * 1000;
const LOGIN_FAIL = "The email or password is not correct.";
const RATE_LIMIT = "Please wait a few minutes and try again.";
const RESET_PUBLIC = "If an account exists for that email, a reset message is on its way.";
const RESET_INVALID = "This reset link is invalid or has expired.";
const REGISTER_DUPLICATE = "An account could not be created. If you already have an account, sign in.";

export type AuthFields = Record<string, string>;

export type PasswordResetMail = {
  to: string;
  resetUrl: string;
};

export type Mailer = {
  sendPasswordReset(message: PasswordResetMail): Promise<void>;
};

export async function registerCustomer(
  input: { name: unknown; email: unknown; password: unknown },
  context: { ip: string; now?: number } = { ip: "unknown" },
): Promise<{ ok: true; customerId: string } | { ok: false; message: string; fields: AuthFields }> {
  const now = context.now ?? Date.now();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = normalizeEmail(input.email);
  const keys = limitKeys("register", context.ip, email);
  if (!(await allow(keys, now))) {
    return { ok: false, message: RATE_LIMIT, fields: {} };
  }
  const passwordMessage = passwordError(input.password);
  const fields: AuthFields = {};
  if (!NAME.test(name)) {
    fields.name = "Enter your name using letters, spaces, apostrophes, or hyphens.";
  }
  if (!email) {
    fields.email = "Enter a valid email address.";
  }
  if (passwordMessage) {
    fields.password = passwordMessage;
  }
  if (Object.keys(fields).length > 0 || !email || typeof input.password !== "string") {
    return { ok: false, message: "Check the highlighted fields.", fields };
  }
  await connectToDatabase();
  try {
    const created = await Customer.create({
      email,
      name,
      passwordHash: await hashCustomerPassword(input.password),
      emailVerified: false,
      sessionVersion: 0,
    });
    return { ok: true, customerId: created.id };
  } catch (error) {
    if (duplicateKey(error)) {
      return { ok: false, message: REGISTER_DUPLICATE, fields: {} };
    }
    console.error(`Customer registration failed: ${redactSecrets(error instanceof Error ? error.message : "Unknown error")}`);
    return { ok: false, message: "The account could not be created. You can try again.", fields: {} };
  }
}

export async function loginCustomer(
  input: { email: unknown; password: unknown },
  context: { ip: string; now?: number } = { ip: "unknown" },
): Promise<{ ok: true; token: string; customerId: string } | { ok: false; message: string }> {
  const now = context.now ?? Date.now();
  const email = normalizeEmail(input.email);
  const keys = limitKeys("login", context.ip, email);
  if (!(await allow(keys, now))) {
    return { ok: false, message: RATE_LIMIT };
  }
  const password = typeof input.password === "string" ? input.password : "";
  await connectToDatabase();
  const customer = email
    ? await Customer.findOne({ email }).select("+passwordHash email emailVerified").lean<{
        _id: { toString(): string };
        passwordHash?: string;
      } | null>()
    : null;
  const matches = await customerPasswordMatches(password, customer?.passwordHash);
  if (!customer || !matches) {
    return { ok: false, message: LOGIN_FAIL };
  }
  const token = await openCustomerSession(customer._id.toString(), now);
  if (!token) {
    return { ok: false, message: LOGIN_FAIL };
  }
  return { ok: true, token, customerId: customer._id.toString() };
}

export async function requestPasswordReset(
  emailInput: unknown,
  context: { ip: string; now?: number; appUrl: string | null; mailer: Mailer },
): Promise<{ message: string }> {
  const now = context.now ?? Date.now();
  const email = normalizeEmail(emailInput);
  const keys = limitKeys("reset", context.ip, email);
  if (!(await allow(keys, now))) {
    return { message: RATE_LIMIT };
  }
  if (!email || !context.appUrl) {
    return { message: RESET_PUBLIC };
  }
  await connectToDatabase();
  const customer = await Customer.findOne({ email }).select("_id").lean<{ _id: Types.ObjectId } | null>();
  if (!customer) {
    return { message: RESET_PUBLIC };
  }
  await PasswordReset.deleteMany({ customerId: customer._id, usedAt: { $exists: false } });
  const token = createSecretToken();
  const tokenHash = hashSecret(token);
  await PasswordReset.create({
    tokenHash,
    customerId: customer._id,
    expiresAt: new Date(now + RESET_MS),
  });
  const resetUrl = `${context.appUrl}/reset-password?token=${token}`;
  try {
    await context.mailer.sendPasswordReset({ to: email, resetUrl });
  } catch {
    await PasswordReset.deleteOne({ tokenHash });
    console.error("Password reset email failed.");
  }
  return { message: RESET_PUBLIC };
}

export async function resetCustomerPassword(
  input: { token: unknown; password: unknown },
  context: { ip: string; now?: number } = { ip: "unknown" },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = context.now ?? Date.now();
  if (!(await allow([`reset-submit:${context.ip}`], now))) {
    return { ok: false, message: RATE_LIMIT };
  }
  const passwordMessage = passwordError(input.password);
  if (passwordMessage || typeof input.password !== "string" || typeof input.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) {
    return { ok: false, message: passwordMessage ?? RESET_INVALID };
  }
  const passwordHash = await hashCustomerPassword(input.password);
  const tokenHash = hashSecret(input.token);
  try {
    await consumeReset(tokenHash, passwordHash, now);
    return { ok: true };
  } catch (error) {
    if (transactionsUnsupported(error)) {
      try {
        await consumeReset(tokenHash, passwordHash, now, false);
        return { ok: true };
      } catch (sequentialError) {
        if (sequentialError instanceof Error && sequentialError.message === "invalid-reset") {
          return { ok: false, message: RESET_INVALID };
        }
        throw sequentialError;
      }
    }
    if (error instanceof Error && error.message === "invalid-reset") {
      return { ok: false, message: RESET_INVALID };
    }
    console.error(`Password reset failed: ${redactSecrets(error instanceof Error ? error.message : "Unknown error")}`);
    return { ok: false, message: "The password could not be reset. Request a new link." };
  }
}

async function consumeReset(tokenHash: string, passwordHash: string, now: number, transactional = true): Promise<void> {
  const work = async (session: import("mongoose").ClientSession | null) => {
    const reset = await PasswordReset.findOneAndUpdate(
      { tokenHash, usedAt: { $exists: false }, expiresAt: { $gt: new Date(now) } },
      { $set: { usedAt: new Date(now) } },
      { session: session ?? undefined, returnDocument: "before" },
    ).lean<{ customerId: Types.ObjectId } | null>();
    if (!reset || !isValidObjectId(reset.customerId.toString())) {
      throw new Error("invalid-reset");
    }
    const updated = await Customer.updateOne(
      { _id: reset.customerId },
      { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
      { session: session ?? undefined },
    );
    if (updated.matchedCount !== 1) {
      throw new Error("invalid-reset");
    }
    await CustomerSession.deleteMany({ customerId: reset.customerId }, { session: session ?? undefined });
    await PasswordReset.deleteMany(
      { customerId: reset.customerId, tokenHash: { $ne: tokenHash } },
      { session: session ?? undefined },
    );
  };
  if (!transactional) {
    await work(null);
    return;
  }
  await runOrderTransaction(work);
}

function limitKeys(action: string, ip: string, email: string | null): string[] {
  const keys = [`${action}:${ip}`];
  if (email) {
    keys.push(`${action}-email:${email}`);
  }
  return keys;
}

async function allow(keys: string[], now: number): Promise<boolean> {
  return (await consumeLimit(keys, customerAuthPolicy(), now)) === "ok";
}

function duplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
}
