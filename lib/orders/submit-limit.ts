const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

type Bucket = { attempts: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function orderSubmitAllowed(key: string, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    return true;
  }
  return bucket.attempts < MAX_ATTEMPTS;
}

export function recordOrderSubmit(key: string, now = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.attempts += 1;
}
