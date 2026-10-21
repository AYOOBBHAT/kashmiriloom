import "server-only";

import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/lib/models/customer";
import { CustomerSession } from "@/lib/models/customer-session";
import { CUSTOMER_SESSION_TTL_SECONDS } from "@/lib/customers/cookie";
import { createSecretToken, hashSecret } from "@/lib/customers/tokens";

export type CurrentCustomer = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  googleConnected: boolean;
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export async function openCustomerSession(customerId: string, now = Date.now()): Promise<string | null> {
  if (!isValidObjectId(customerId)) {
    return null;
  }
  await connectToDatabase();
  const customer = await Customer.findById(customerId).select("sessionVersion").lean<{ sessionVersion: number } | null>();
  if (!customer) {
    return null;
  }
  const token = createSecretToken();
  await CustomerSession.create({
    tokenHash: hashSecret(token),
    customerId,
    sessionVersion: customer.sessionVersion,
    expiresAt: new Date(now + CUSTOMER_SESSION_TTL_SECONDS * 1000),
  });
  return token;
}

export async function customerFromSessionToken(token: string, now = Date.now()): Promise<CurrentCustomer | null> {
  if (!TOKEN.test(token)) {
    return null;
  }
  await connectToDatabase();
  const session = await CustomerSession.findOne({ tokenHash: hashSecret(token) })
    .select("customerId sessionVersion expiresAt")
    .lean<{ customerId: { toString(): string }; sessionVersion: number; expiresAt: Date } | null>();
  if (!session || session.expiresAt.getTime() <= now) {
    if (session) {
      await CustomerSession.deleteOne({ tokenHash: hashSecret(token) });
    }
    return null;
  }
  const customer = await Customer.findById(session.customerId)
    .select("email name emailVerified sessionVersion googleSub")
    .lean<{ email: string; name: string; emailVerified: boolean; sessionVersion: number; googleSub?: string } | null>();
  if (!customer || customer.sessionVersion !== session.sessionVersion) {
    await CustomerSession.deleteOne({ tokenHash: hashSecret(token) });
    return null;
  }
  return {
    id: session.customerId.toString(),
    email: customer.email,
    name: customer.name,
    emailVerified: customer.emailVerified,
    googleConnected: Boolean(customer.googleSub),
  };
}

export async function destroyCustomerSession(token: string): Promise<void> {
  if (!TOKEN.test(token)) {
    return;
  }
  await connectToDatabase();
  await CustomerSession.deleteOne({ tokenHash: hashSecret(token) });
}

export async function destroyCustomerSessions(customerId: string): Promise<void> {
  if (!isValidObjectId(customerId)) {
    return;
  }
  await connectToDatabase();
  await CustomerSession.deleteMany({ customerId });
}
