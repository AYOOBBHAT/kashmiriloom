import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAdminCredentials } from "@/lib/auth/credentials";
import { connectToDatabase, disconnectDatabase } from "@/lib/mongodb";
import { paymentAttemptStatus } from "@/lib/payments/attempt-limit";
import { customerAuthPolicy, paymentAttemptPolicy } from "@/lib/rate-limit/policy";
import {
  redisCounterStore,
  resetCustomerAuthLimits,
  unconfiguredRateLimitStore,
  useMemoryRateLimits,
  useRateLimitStore,
  type CounterStore,
} from "@/lib/rate-limit/shared";
import { loadSeedEnv } from "@/scripts/load-env";

loadSeedEnv();

const INVALID = "Those details were not accepted.";
const LIMITED = "Those details were not accepted. Wait a few minutes before trying again.";
const UNAVAILABLE = "This request cannot be completed right now. Please try again in a few minutes.";
const PAYMENT_LIMITED = "Please wait a few minutes before trying payment again.";
const EMAIL = "limit-check@example.com";
const PASSWORD = "wrong-password-1";
const NOW = 1_700_000_000_000;
const savedSecret = process.env.ADMIN_SESSION_SECRET;

describe("shared admin and payment limits", { concurrency: false }, () => {
  before(async () => {
    useMemoryRateLimits();
    if ((process.env.ADMIN_SESSION_SECRET?.trim().length ?? 0) < 32) {
      process.env.ADMIN_SESSION_SECRET = "rate-limit-test-secret-value-32chars";
    }
    await connectToDatabase();
  });

  beforeEach(() => {
    useMemoryRateLimits();
    resetCustomerAuthLimits();
  });

  after(async () => {
    useMemoryRateLimits();
    resetCustomerAuthLimits();
    if (savedSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = savedSecret;
    }
    await disconnectDatabase();
  });

  test("allows admin attempts through the limit, then rejects the next one", async () => {
    const policy = customerAuthPolicy();
    for (let attempt = 0; attempt < policy.max; attempt += 1) {
      const allowed = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.10", NOW);
      assert.equal(allowed.ok, false);
      if (!allowed.ok) {
        assert.equal(allowed.message, INVALID);
      }
    }
    const logged = await capture(async () => {
      const blocked = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.10", NOW);
      assert.equal(blocked.ok, false);
      if (!blocked.ok) {
        assert.equal(blocked.message, LIMITED);
      }
    });
    assert.match(logged.join("\n"), /action=admin-login reason=limited category=/);
    assert.equal(leaks(logged, [EMAIL, PASSWORD, "192.0.2.10"]), false);
    const renewed = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.10", NOW + policy.windowMs);
    assert.equal(renewed.ok, false);
    if (!renewed.ok) {
      assert.equal(renewed.message, INVALID);
    }
  });

  test("limits admin attempts by normalized email and by address", async () => {
    const policy = customerAuthPolicy();
    for (let attempt = 0; attempt < policy.max; attempt += 1) {
      const failed = await checkAdminCredentials("Limit.Check@Example.com", PASSWORD, "192.0.2.20", NOW);
      assert.equal(failed.ok, false);
      if (!failed.ok) {
        assert.equal(failed.message, INVALID);
      }
    }
    const sameEmail = await checkAdminCredentials("limit.check@example.com", PASSWORD, "192.0.2.21", NOW);
    assert.equal(sameEmail.ok, false);
    if (!sameEmail.ok) {
      assert.equal(sameEmail.message, LIMITED);
    }
    resetCustomerAuthLimits();
    for (let attempt = 0; attempt < policy.max; attempt += 1) {
      await checkAdminCredentials("first-limit@example.com", PASSWORD, "192.0.2.30", NOW);
    }
    const sharedAddress = await checkAdminCredentials("second-limit@example.com", PASSWORD, "192.0.2.30", NOW);
    assert.equal(sharedAddress.ok, false);
    if (!sharedAddress.ok) {
      assert.equal(sharedAddress.message, LIMITED);
    }
    const separateAddress = await checkAdminCredentials("second-limit@example.com", PASSWORD, "192.0.2.31", NOW);
    assert.equal(separateAddress.ok, false);
    if (!separateAddress.ok) {
      assert.equal(separateAddress.message, INVALID);
    }
  });

  test("shares an admin limit across two limiter clients", async () => {
    const policy = customerAuthPolicy();
    const stores = pairedStores(policy.windowMs);
    useRateLimitStore(stores.first);
    for (let attempt = 0; attempt < policy.max; attempt += 1) {
      const allowed = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.40", NOW);
      assert.equal(allowed.ok, false);
      if (!allowed.ok) {
        assert.equal(allowed.message, INVALID);
      }
    }
    useRateLimitStore(stores.second);
    const blocked = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.40", NOW);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.message, LIMITED);
    }
    assert.equal(stores.counts.get("kl:admin-login:192.0.2.40"), policy.max + 1);
  });

  test("allows payment attempts through the limit and keeps prepare and confirm apart", async () => {
    const policy = paymentAttemptPolicy();
    for (let attempt = 0; attempt < policy.max; attempt += 1) {
      assert.equal(await paymentAttemptStatus("prepare", "192.0.2.50", NOW), null);
    }
    const logged = await capture(async () => {
      assert.equal(await paymentAttemptStatus("prepare", "192.0.2.50", NOW), PAYMENT_LIMITED);
    });
    assert.match(logged.join("\n"), /action=payment-prepare reason=limited category=address/);
    assert.equal(leaks(logged, ["192.0.2.50"]), false);
    assert.equal(await paymentAttemptStatus("confirm", "192.0.2.50", NOW), null);
    const renewed = await paymentAttemptStatus("prepare", "192.0.2.50", NOW + policy.windowMs);
    assert.equal(renewed, null);
  });

  test("shares a payment limit across two limiter clients", async () => {
    const policy = paymentAttemptPolicy();
    const stores = pairedStores(policy.windowMs);
    useRateLimitStore(stores.first);
    for (let attempt = 0; attempt < policy.max; attempt += 1) {
      assert.equal(await paymentAttemptStatus("confirm", "192.0.2.60", NOW), null);
    }
    useRateLimitStore(stores.second);
    assert.equal(await paymentAttemptStatus("confirm", "192.0.2.60", NOW), PAYMENT_LIMITED);
    assert.equal(await paymentAttemptStatus("prepare", "192.0.2.60", NOW), null);
    assert.equal(stores.counts.get("kl:payment-confirm:192.0.2.60"), policy.max + 1);
  });

  test("fails closed when the shared counter is missing or Redis throws", async () => {
    const logged = await capture(async () => {
      useRateLimitStore(unconfiguredRateLimitStore());
      const missingAdmin = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.70", NOW);
      assert.equal(missingAdmin.ok, false);
      if (!missingAdmin.ok) {
        assert.equal(missingAdmin.message, UNAVAILABLE);
      }
      assert.equal(await paymentAttemptStatus("prepare", "192.0.2.71", NOW), UNAVAILABLE);
      useRateLimitStore({
        async increment() {
          throw new Error("UPSTASH_REDIS_REST_TOKEN=super-secret-token refused");
        },
      });
      const failedAdmin = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.72", NOW);
      assert.equal(failedAdmin.ok, false);
      if (!failedAdmin.ok) {
        assert.equal(failedAdmin.message, UNAVAILABLE);
      }
      assert.equal(await paymentAttemptStatus("confirm", "192.0.2.73", NOW), UNAVAILABLE);
    });
    assert.match(logged.join("\n"), /action=admin-login reason=unconfigured category=store/);
    assert.match(logged.join("\n"), /action=payment-prepare reason=unconfigured category=store/);
    assert.match(logged.join("\n"), /action=admin-login reason=redis category=store/);
    assert.match(logged.join("\n"), /action=payment-confirm reason=redis category=store/);
    assert.equal(leaks(logged, [EMAIL, PASSWORD, "192.0.2.70", "super-secret-token"]), false);
    useMemoryRateLimits();
    resetCustomerAuthLimits();
    const restored = await checkAdminCredentials(EMAIL, PASSWORD, "192.0.2.74", NOW);
    assert.equal(restored.ok, false);
    if (!restored.ok) {
      assert.equal(restored.message, INVALID);
    }
    assert.equal(await paymentAttemptStatus("prepare", "192.0.2.74", NOW), null);
  });

  test("keeps payment actions on the shared address helper", () => {
    const source = readFileSync(join(root(), "app/(store)/checkout/payment-actions.ts"), "utf8");
    assert.match(source, /paymentAttemptStatus\("prepare", clientAddress/);
    assert.match(source, /paymentAttemptStatus\("confirm", clientAddress/);
    assert.doesNotMatch(source, /x-forwarded-for/i);
    assert.doesNotMatch(source, /new Map/);
  });
});

function pairedStores(windowMs: number): { counts: Map<string, number>; first: CounterStore; second: CounterStore } {
  const counts = new Map<string, number>();
  const evalScript = async (script: string, keys: string[], args: string[]) => {
    assert.match(script, /INCR/);
    assert.match(script, /PEXPIRE/);
    assert.equal(keys.length, 1);
    assert.equal(Number(args[0]), windowMs);
    const key = keys[0] ?? "";
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  };
  return {
    counts,
    first: redisCounterStore({ eval: evalScript }),
    second: redisCounterStore({ eval: evalScript }),
  };
}

function root(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

async function capture(run: () => Promise<void>): Promise<string[]> {
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  try {
    await run();
  } finally {
    console.error = original;
  }
  return logged;
}

function leaks(lines: string[], values: string[]): boolean {
  const text = lines.join("\n");
  return values.some((value) => text.includes(value));
}
