import "server-only";

import { CatalogueAccessError } from "@/lib/catalogue-error";
import { passwordsMatch } from "@/lib/auth/password";
import { sessionSecret } from "@/lib/auth/cookie";
import { normalizeEmail } from "@/lib/customers/email";
import { customerAuthPolicy } from "@/lib/rate-limit/policy";
import { consumeLimit } from "@/lib/rate-limit/shared";
import { connectToDatabase } from "@/lib/mongodb";
import { Admin } from "@/lib/models/admin";

const INVALID = "Those details were not accepted.";
const LIMITED = "Those details were not accepted. Wait a few minutes before trying again.";
const UNAVAILABLE = "This request cannot be completed right now. Please try again in a few minutes.";
const UNCONFIGURED = "Administrator sign-in is not configured on the server.";

export async function checkAdminCredentials(
  email: string,
  password: string,
  addressKey: string,
  now = Date.now(),
): Promise<{ ok: true; adminId: string } | { ok: false; message: string }> {
  if (!sessionSecret()) {
    return { ok: false, message: UNCONFIGURED };
  }
  const normalized = normalizeEmail(email);
  const keys = [`admin-login:${addressKey}`];
  if (normalized) {
    keys.push(`admin-login-email:${normalized}`);
  }
  const outcome = await consumeLimit(keys, customerAuthPolicy(), now);
  if (outcome.decision === "limited") {
    return { ok: false, message: LIMITED };
  }
  if (outcome.decision !== "ok") {
    return { ok: false, message: UNAVAILABLE };
  }

  if (!normalized || password.length < 1 || password.length > 200) {
    return { ok: false, message: INVALID };
  }

  try {
    await connectToDatabase();
    const admin = await Admin.findOne({ email: normalized })
      .select("+passwordHash")
      .lean<{ _id: unknown; passwordHash?: string } | null>();
    const matches = await passwordsMatch(password, admin?.passwordHash ?? "");
    if (!admin || !matches) {
      return { ok: false, message: INVALID };
    }
    return { ok: true, adminId: String(admin._id) };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      return { ok: false, message: error.message };
    }
    console.error("Administrator sign-in could not be checked.");
    return { ok: false, message: INVALID };
  }
}
