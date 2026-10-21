import "server-only";

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { isValidObjectId } from "mongoose";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  adminCookieOptions,
  sessionSecret,
} from "@/lib/auth/cookie";
import { connectToDatabase } from "@/lib/mongodb";
import { Admin } from "@/lib/models/admin";
import { CatalogueAccessError } from "@/lib/catalogue-error";

type SessionData = {
  adminId?: string;
};

export type CurrentAdmin = {
  id: string;
  email: string;
};

function options(): SessionOptions | null {
  const password = sessionSecret();
  if (!password) {
    return null;
  }
  return {
    password,
    cookieName: ADMIN_COOKIE_NAME,
    ttl: ADMIN_SESSION_TTL_SECONDS,
    cookieOptions: adminCookieOptions(process.env.NODE_ENV),
  };
}

async function openSession() {
  // iron-session reads the current time while unsealing. That has to wait
  // until a real request, or the dashboard prerender rejects it.
  await connection();
  const sessionOptions = options();
  if (!sessionOptions) {
    return null;
  }
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await openSession();
  const adminId = session?.adminId;
  if (!adminId || !/^[a-f\d]{24}$/i.test(adminId) || !isValidObjectId(adminId)) {
    return null;
  }
  await connectToDatabase();
  const admin = await Admin.findById(adminId).select("email").lean<{ email: string } | null>();
  if (!admin?.email) {
    return null;
  }
  return { id: adminId, email: admin.email };
}

export async function createAdminSession(adminId: string): Promise<void> {
  const session = await openSession();
  if (!session) {
    throw new CatalogueAccessError(
      "unavailable",
      "Administrator sign-in is not configured on the server.",
    );
  }
  session.adminId = adminId;
  await session.save();
}

export async function destroyAdminSession(): Promise<void> {
  const session = await openSession();
  session?.destroy();
}
