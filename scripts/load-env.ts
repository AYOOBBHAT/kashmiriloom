import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnv(text: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const separator = body.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = body.slice(0, separator).trim();
    let value = body.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      entries.set(key, value);
    }
  }
  return entries;
}

function readEnvFile(name: string): Map<string, string> | null {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) {
    return null;
  }
  return parseEnv(readFileSync(path, "utf8"));
}

export type SeedEnvSource = ".env.local" | ".env" | "process" | "missing";

/** Match Next.js precedence for the seed script: .env.local overrides .env. */
export function loadSeedEnv(): SeedEnvSource {
  const alreadySet = process.env.MONGODB_URI?.trim();
  const shared = readEnvFile(".env");
  const local = readEnvFile(".env.local");

  if (shared) {
    for (const [key, value] of shared) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
  if (local) {
    for (const [key, value] of local) {
      process.env[key] = value;
    }
  }

  if (local?.has("MONGODB_URI") && local.get("MONGODB_URI")?.trim()) {
    return ".env.local";
  }
  if (alreadySet) {
    return "process";
  }
  if (shared?.has("MONGODB_URI") && process.env.MONGODB_URI?.trim()) {
    return ".env";
  }
  return "missing";
}
