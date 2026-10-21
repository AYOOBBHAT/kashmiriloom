import "server-only";

import { Redis } from "@upstash/redis";
import type { RatePolicy } from "@/lib/rate-limit/policy";

export type LimitDecision = "ok" | "limited" | "unavailable";

export type CounterStore = {
  increment(key: string, windowMs: number, now: number): Promise<number>;
  reset?(): void;
};

type RedisEval = {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
};

export const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

const memoryStore = createMemoryRateLimitStore();
let override: CounterStore | null = null;
let production: CounterStore | null = null;
let unavailableReported = false;

export function createMemoryRateLimitStore(): CounterStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async increment(key, windowMs, now) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return 1;
      }
      bucket.count += 1;
      return bucket.count;
    },
    reset() {
      buckets.clear();
    },
  };
}

export function redisCounterStore(redis: RedisEval): CounterStore {
  return {
    async increment(key, windowMs) {
      const count = await redis.eval(RATE_LIMIT_SCRIPT, [key], [String(windowMs)]);
      const parsed = typeof count === "number" ? count : Number(count);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("Rate limit store returned an unexpected count.");
      }
      return parsed;
    },
  };
}

export function readUpstashConfig(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (!url.startsWith("https://") || url.length > 200 || token.length < 20 || token.length > 500) {
    return null;
  }
  if (/[\s\r\n]/.test(url) || /[\s\r\n]/.test(token)) {
    return null;
  }
  return { url, token };
}

export function unconfiguredRateLimitStore(): CounterStore {
  return {
    async increment() {
      throw new Error("unconfigured");
    },
  };
}

export function useMemoryRateLimits(): void {
  override = memoryStore;
}

export function useRateLimitStore(store: CounterStore): void {
  override = store;
}

export function resetCustomerAuthLimits(): void {
  memoryStore.reset?.();
  unavailableReported = false;
}

export async function consumeLimit(keys: string[], policy: RatePolicy, now = Date.now()): Promise<LimitDecision> {
  try {
    const counts = await Promise.all(keys.map((key) => activeStore().increment(`kl:${key}`, policy.windowMs, now)));
    return counts.some((count) => count > policy.max) ? "limited" : "ok";
  } catch {
    if (!unavailableReported) {
      unavailableReported = true;
      console.error("Shared rate limit store is unavailable.");
    }
    return "unavailable";
  }
}

function activeStore(): CounterStore {
  if (override) {
    return override;
  }
  production ??= createProductionStore();
  return production;
}

function createProductionStore(): CounterStore {
  const config = readUpstashConfig();
  if (!config) {
    return unconfiguredRateLimitStore();
  }
  const redis = new Redis({ url: config.url, token: config.token });
  return redisCounterStore(redis);
}
