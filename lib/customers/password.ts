import { randomBytes } from "node:crypto";
import { argon2Verify, argon2id } from "hash-wasm";

const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;

let placeholder: Promise<string> | null = null;

function placeholderHash(): Promise<string> {
  placeholder ??= hashCustomerPassword("customer-password-placeholder");
  return placeholder;
}

export function passwordError(value: unknown): string | null {
  if (typeof value !== "string" || value.length < MIN_PASSWORD || value.length > MAX_PASSWORD) {
    return "Use a password between 10 and 200 characters.";
  }
  return null;
}

export function hashCustomerPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: randomBytes(16),
    parallelism: 1,
    iterations: 2,
    memorySize: 19_456,
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function customerPasswordMatches(password: string, passwordHash: string | undefined): Promise<boolean> {
  try {
    if (!passwordHash) {
      await argon2Verify({ password, hash: await placeholderHash() });
      return false;
    }
    const matches = await argon2Verify({ password, hash: passwordHash });
    return passwordHash.startsWith("$argon2id$") && matches;
  } catch {
    return false;
  }
}
