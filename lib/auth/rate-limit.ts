const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = {
  attempts: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim() ?? "";
  if (/^[a-fA-F0-9:.]{3,64}$/.test(first)) {
    return first;
  }
  return "unknown";
}

export function loginAllowed(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return true;
  }
  return bucket.attempts < MAX_ATTEMPTS;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.attempts += 1;
}

export function clearLoginFailures(key: string): void {
  buckets.delete(key);
}

export function resetLoginLimits(): void {
  buckets.clear();
}
