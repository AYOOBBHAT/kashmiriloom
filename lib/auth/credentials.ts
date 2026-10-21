import "server-only";

import { CatalogueAccessError } from "@/lib/catalogue-error";
import { passwordsMatch } from "@/lib/auth/password";
import {
  clearLoginFailures,
  loginAllowed,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { sessionSecret } from "@/lib/auth/cookie";
import { connectToDatabase } from "@/lib/mongodb";
import { Admin } from "@/lib/models/admin";

const INVALID = "Those details were not accepted.";
const LIMITED = "Those details were not accepted. Wait a few minutes before trying again.";
const UNCONFIGURED = "Administrator sign-in is not configured on the server.";

export async function checkAdminCredentials(
  email: string,
  password: string,
  addressKey: string,
): Promise<{ ok: true; adminId: string } | { ok: false; message: string }> {
  if (!sessionSecret()) {
    return { ok: false, message: UNCONFIGURED };
  }
  if (!loginAllowed(addressKey)) {
    return { ok: false, message: LIMITED };
  }

  const normalized = email.trim().toLowerCase();
  const plausible =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) &&
    normalized.length <= 120 &&
    password.length >= 1 &&
    password.length <= 200;

  if (!plausible) {
    recordLoginFailure(addressKey);
    return { ok: false, message: INVALID };
  }

  try {
    await connectToDatabase();
    const admin = await Admin.findOne({ email: normalized })
      .select("+passwordHash")
      .lean<{ _id: unknown; passwordHash?: string } | null>();
    const matches = await passwordsMatch(password, admin?.passwordHash ?? "");
    if (!admin || !matches) {
      recordLoginFailure(addressKey);
      return { ok: false, message: INVALID };
    }
    clearLoginFailures(addressKey);
    return { ok: true, adminId: String(admin._id) };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      return { ok: false, message: error.message };
    }
    console.error("Administrator sign-in could not be checked.");
    return { ok: false, message: INVALID };
  }
}
