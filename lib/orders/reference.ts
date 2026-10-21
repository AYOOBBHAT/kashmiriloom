import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERENCE_BODY = 16;

export function isPublicReference(value: string): boolean {
  return new RegExp(`^KL-[${ALPHABET}]{${REFERENCE_BODY}}$`).test(value);
}

export function createPublicReference(): string {
  return `KL-${randomFromAlphabet(REFERENCE_BODY)}`;
}

export function createViewToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashViewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function viewCookieGrants(
  cookieValue: string | undefined,
  reference: string,
  tokenHash: string,
): boolean {
  if (!cookieValue || !isPublicReference(reference) || !/^[a-f0-9]{64}$/.test(tokenHash)) {
    return false;
  }
  const split = cookieValue.indexOf(".");
  if (split <= 0) {
    return false;
  }
  const cookieReference = cookieValue.slice(0, split);
  const token = cookieValue.slice(split + 1);
  if (cookieReference !== reference || !/^[a-f0-9]{64}$/.test(token)) {
    return false;
  }
  const actual = Buffer.from(hashViewToken(token), "hex");
  const expected = Buffer.from(tokenHash, "hex");
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function randomFromAlphabet(length: number): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = randomBytes(length);
    for (const byte of bytes) {
      if (byte < limit) {
        out += ALPHABET[byte % ALPHABET.length];
        if (out.length === length) {
          break;
        }
      }
    }
  }
  return out;
}
