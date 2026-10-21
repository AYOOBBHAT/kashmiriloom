import { compare, hash } from "bcryptjs";

const BCRYPT_COST = 12;

let dummyHash: Promise<string> | null = null;

function placeholderHash(): Promise<string> {
  dummyHash ??= hash("not-an-administrator-password", BCRYPT_COST);
  return dummyHash;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export async function passwordsMatch(password: string, passwordHash: string): Promise<boolean> {
  const hashToCheck = passwordHash || (await placeholderHash());
  try {
    const matches = await compare(password, hashToCheck);
    return Boolean(passwordHash) && matches;
  } catch {
    return false;
  }
}
