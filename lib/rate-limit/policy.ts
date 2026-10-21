export type RatePolicy = {
  max: number;
  windowMs: number;
};

const AUTH_MAX = 5;
const ORDER_MAX = 10;
const WINDOW_MS = 15 * 60 * 1000;

export function customerAuthPolicy(env: Record<string, string | undefined> = process.env): RatePolicy {
  return {
    max: boundedInt(env.AUTH_RATE_LIMIT_MAX, AUTH_MAX, 100),
    windowMs: boundedInt(env.AUTH_RATE_LIMIT_WINDOW_MS, WINDOW_MS, 24 * 60 * 60 * 1000),
  };
}

export function orderSubmitPolicy(env: Record<string, string | undefined> = process.env): RatePolicy {
  return {
    max: boundedInt(env.ORDER_RATE_LIMIT_MAX, ORDER_MAX, 100),
    windowMs: boundedInt(env.ORDER_RATE_LIMIT_WINDOW_MS, WINDOW_MS, 24 * 60 * 60 * 1000),
  };
}

function boundedInt(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    return fallback;
  }
  return parsed;
}
