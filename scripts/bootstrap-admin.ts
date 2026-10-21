/**
 * Creates the first administrator, or resets that account's password when asked.
 * Run with `pnpm admin:bootstrap`.
 * Add `--reset-password` to replace the password for the email in ADMIN_EMAIL.
 * This does not run when a page loads, and it does not print the password.
 */
import { hashPassword } from "@/lib/auth/password";
import { CatalogueAccessError, redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase, disconnectDatabase } from "@/lib/mongodb";
import { Admin } from "@/lib/models/admin";
import { loadSeedEnv } from "./load-env";

function emailFromEnv(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return null;
  }
  return email;
}

async function main() {
  const source = loadSeedEnv();
  const email = emailFromEnv();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const reset = process.argv.includes("--reset-password");

  if (!process.env.MONGODB_URI?.trim() || source === "missing") {
    console.error("MONGODB_URI is not set. Add it to .env.local and run pnpm admin:bootstrap again.");
    process.exitCode = 1;
    return;
  }
  if (!email || password.length < 10 || password.length > 200) {
    console.error(
      "Set ADMIN_EMAIL and an ADMIN_PASSWORD of 10 to 200 characters in .env.local. The password is not printed.",
    );
    process.exitCode = 1;
    return;
  }
  if ((process.env.ADMIN_SESSION_SECRET?.trim().length ?? 0) < 32) {
    console.error(
      "ADMIN_SESSION_SECRET must be at least 32 characters before sign-in will work. The value is not printed.",
    );
    process.exitCode = 1;
    return;
  }

  await connectToDatabase();
  const existing = await Admin.findOne({ email }).select("email");
  const others = await Admin.countDocuments(existing ? { email: { $ne: email } } : {});

  if (!existing && others > 0) {
    console.error(
      "An administrator already exists for a different email. This script did not create another account or change a password.",
    );
    process.exitCode = 1;
    return;
  }

  if (existing && !reset) {
    console.log(
      `An administrator for ${email} already exists. The password was left unchanged. Run pnpm admin:bootstrap -- --reset-password to replace it.`,
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  if (!existing) {
    await Admin.create({ email, passwordHash });
    console.log(`Created the administrator account for ${email}. The password was hashed and not printed.`);
    return;
  }

  await Admin.updateOne({ email }, { $set: { passwordHash } });
  console.log(`Replaced the password hash for ${email}. The password was not printed.`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof CatalogueAccessError) {
      console.error(error.message);
    } else {
      const detail = error instanceof Error ? error.message : "Unknown error";
      console.error(`Administrator setup failed. ${redactSecrets(detail)}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
  });
