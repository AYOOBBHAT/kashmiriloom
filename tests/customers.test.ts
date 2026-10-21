import assert from "node:assert/strict";
import type { Types } from "mongoose";
import { after, before, beforeEach, describe, test } from "node:test";
import { loadSeedEnv } from "@/scripts/load-env";
import { hashPassword, passwordsMatch } from "@/lib/auth/password";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/cookie";
import { clientAddress } from "@/lib/auth/rate-limit";
import { connectToDatabase, disconnectDatabase } from "@/lib/mongodb";
import { Admin } from "@/lib/models/admin";
import { Customer } from "@/lib/models/customer";
import { CustomerSession } from "@/lib/models/customer-session";
import { Order } from "@/lib/models/order";
import { PasswordReset } from "@/lib/models/password-reset";
import { Product } from "@/lib/models/product";
import { createGuestOrder } from "@/lib/orders/create";
import { readPublicOrder } from "@/lib/orders/lookup";
import {
  loginCustomer,
  registerCustomer,
  requestPasswordReset,
  resetCustomerPassword,
  type Mailer,
} from "@/lib/customers/accounts";
import { CUSTOMER_COOKIE_NAME, customerCookieOptions } from "@/lib/customers/cookie";
import { normalizeEmail } from "@/lib/customers/email";
import {
  exchangeGoogleAuthorizationCode,
  googleAuthorizationUrl,
  googleClaimsAreTrusted,
  readGoogleCallback,
  signInWithGoogleIdentity,
  verifyGoogleIdToken,
} from "@/lib/customers/google";
import { resetCustomerAuthLimits, useMemoryRateLimits, useRateLimitStore } from "@/lib/customers/limits";
import { listOwnedOrders, readOwnedOrder } from "@/lib/customers/orders";
import { orderSubmitAllowed } from "@/lib/orders/submit-limit";
import { customerAuthPolicy, orderSubmitPolicy } from "@/lib/rate-limit/policy";
import { consumeLimit, readUpstashConfig, redisCounterStore, unconfiguredRateLimitStore } from "@/lib/rate-limit/shared";
import { authRedirectUrl, safeNextPath } from "@/lib/customers/paths";
import { createResendMailer } from "@/lib/customers/resend";
import { customerFromSessionToken, destroyCustomerSession } from "@/lib/customers/sessions";
import { createSecretToken, hashSecret } from "@/lib/customers/tokens";

loadSeedEnv();

const SKU = "KL-CUST-SHAWL";
const PASSWORD = "correct-horse-1";
const APP = "https://shop.example";
let nishatStock = 0;
let sequence = 0;

describe("customer accounts", { concurrency: false }, () => {
  before(async () => {
    useMemoryRateLimits();
    await connectToDatabase();
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.ok(nishat);
    assert.equal(nishat.active, true);
    nishatStock = nishat.stockQuantity;
    await cleanup();
    await Product.create({
      name: "Customer test shawl",
      slug: "phase-customer-shawl",
      description: "Temporary shawl used to test customer orders.",
      category: "everyday",
      pricePaise: 100_000,
      images: [{ url: "/images/shawl-chinar.jpg", alt: "Folded test shawl" }],
      sku: SKU,
      stockQuantity: 20,
      active: true,
      featured: false,
      currency: "INR",
    });
  });

  beforeEach(async () => {
    useMemoryRateLimits();
    resetCustomerAuthLimits();
    await Order.deleteMany({ "lines.sku": SKU });
    await Product.updateOne({ sku: SKU }, { stockQuantity: 20, active: true });
  });

  after(async () => {
    await cleanup();
    await Product.deleteMany({ sku: SKU });
    const nishat = await Product.findOne({ sku: "KL-SAMPLE-NISHAT" }).select("stockQuantity active").lean<{
      stockQuantity: number;
      active: boolean;
    } | null>();
    assert.equal(nishat?.active, true);
    assert.equal(nishat?.stockQuantity, nishatStock);
    await disconnectDatabase();
  });

  test("registers a normalized email, stores an Argon2id hash, and signs in before email verification", async () => {
    const email = nextEmail();
    const created = await registerCustomer(
      { name: "Amina Shah", email: `  ${email.toUpperCase()}  `, password: PASSWORD },
      { ip: "203.0.113.10" },
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const stored = await Customer.findById(created.customerId).select("+passwordHash email emailVerified").lean<{
      email: string;
      emailVerified: boolean;
      passwordHash?: string;
    } | null>();
    assert.equal(stored?.email, email);
    assert.equal(stored?.emailVerified, false);
    assert.match(stored?.passwordHash ?? "", /^\$argon2id\$/);
    assert.equal(stored?.passwordHash?.includes(PASSWORD), false);
    const signedIn = await loginCustomer({ email, password: PASSWORD }, { ip: "203.0.113.11" });
    assert.equal(signedIn.ok, true);
    assert.equal(await Admin.countDocuments({ email }), 0);
  });

  test("rejects a duplicate registration without creating a second customer", async () => {
    const email = nextEmail();
    const first = await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.12" });
    const second = await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.13" });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    if (second.ok) {
      return;
    }
    assert.equal(second.message.includes(email), false);
    assert.equal(await Customer.countDocuments({ email }), 1);
  });

  test("returns the same login error for an unknown email and a wrong password", async () => {
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.14" });
    const unknown = await loginCustomer({ email: nextEmail(), password: PASSWORD }, { ip: "203.0.113.15" });
    const wrong = await loginCustomer({ email, password: "wrong-password-1" }, { ip: "203.0.113.16" });
    assert.equal(unknown.ok, false);
    assert.equal(wrong.ok, false);
    if (unknown.ok || wrong.ok) {
      return;
    }
    assert.equal(unknown.message, wrong.message);
  });

  test("rate limits registration and login", async () => {
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.20" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await loginCustomer({ email, password: "wrong-password-1" }, { ip: "203.0.113.21" });
      assert.equal(failed.ok, false);
    }
    const blocked = await loginCustomer({ email, password: PASSWORD }, { ip: "203.0.113.21" });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.match(blocked.message, /wait/i);
    }
    resetCustomerAuthLimits();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const created = await registerCustomer(
        { name: "Amina Shah", email: nextEmail(), password: PASSWORD },
        { ip: "203.0.113.22" },
      );
      assert.equal(created.ok, true);
    }
    const limited = await registerCustomer(
      { name: "Amina Shah", email: nextEmail(), password: PASSWORD },
      { ip: "203.0.113.22" },
    );
    assert.equal(limited.ok, false);
    resetCustomerAuthLimits();
    const target = nextEmail();
    await registerCustomer({ name: "Amina Shah", email: target, password: PASSWORD }, { ip: "203.0.113.80" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await loginCustomer({ email: target, password: "wrong-password-1" }, { ip: `198.51.100.${attempt + 1}` });
      assert.equal(failed.ok, false);
    }
    const rotated = await loginCustomer({ email: target, password: PASSWORD }, { ip: "198.51.100.90" });
    assert.equal(rotated.ok, false);
    if (!rotated.ok) {
      assert.match(rotated.message, /wait/i);
    }
  });

  test("accepts a trusted Google identity and rejects a bad audience, expiry, or issuer", async () => {
    const clientId = "google-client-test";
    const now = Date.now();
    const good = googleClaimsAreTrusted(identity("google-sub-1", nextEmail(), clientId, now), clientId, now);
    assert.equal(good.ok, true);
    assert.equal(googleClaimsAreTrusted(identity("google-sub-1", nextEmail(), "other-client", now), clientId, now).ok, false);
    const expired = identity("google-sub-1", nextEmail(), clientId, now);
    expired.expiresAt = Math.floor(now / 1000) - 10;
    assert.equal(googleClaimsAreTrusted(expired, clientId, now).ok, false);
    const badIssuer = identity("google-sub-1", nextEmail(), clientId, now);
    badIssuer.issuer = "https://evil.example";
    assert.equal(googleClaimsAreTrusted(badIssuer, clientId, now).ok, false);
    assert.equal((await verifyGoogleIdToken("not-a-jwt", clientId, now)).ok, false);
  });

  test("handles Google cancellation, callback failure, and duplicate subjects", async () => {
    assert.equal(readGoogleCallback({ error: "access_denied", code: null, state: "state" }, { state: "state", verifier: "v".repeat(43) }).ok, false);
    const mismatch = readGoogleCallback(
      { error: null, code: "auth-code-value", state: "returned-state" },
      { state: "stored-state", verifier: "v".repeat(43) },
    );
    assert.equal(mismatch.ok, false);
    const clientId = "google-client-test";
    const email = nextEmail();
    const claims = identity("google-sub-shared", email, clientId, Date.now());
    const first = await signInWithGoogleIdentity(claims, { clientId });
    const second = await signInWithGoogleIdentity({ ...claims, email: nextEmail() }, { clientId });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.customerId, second.customerId);
    assert.equal(await Customer.countDocuments({ googleSub: "google-sub-shared" }), 1);
    assert.equal(await Admin.countDocuments({ email }), 0);
  });

  test("does not link Google to a password account from a matching email alone", async () => {
    const email = nextEmail();
    const created = await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.30" });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const clientId = "google-client-test";
    const linked = await signInWithGoogleIdentity(identity("google-sub-unlinked", email, clientId, Date.now()), { clientId });
    assert.equal(linked.ok, false);
    const stored = await Customer.findById(created.customerId).select("googleSub emailVerified").lean<{
      googleSub?: string;
      emailVerified: boolean;
    } | null>();
    assert.equal(stored?.googleSub, undefined);
    assert.equal(stored?.emailVerified, false);
    const safeLink = await signInWithGoogleIdentity(identity("google-sub-linked", email, clientId, Date.now()), {
      clientId,
      currentCustomerId: created.customerId,
      link: true,
    });
    assert.equal(safeLink.ok, true);
    const after = await Customer.findById(created.customerId).select("googleSub").lean<{ googleSub?: string } | null>();
    assert.equal(after?.googleSub, "google-sub-linked");
  });

  test("sends reset mail through the Resend mailer without revealing whether the email exists", async () => {
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.40" });
    const sent: Array<{ from: string; to: string; text: string }> = [];
    const mailer = createResendMailer(
      { emails: { send: async (message) => void sent.push(message) } },
      "KashmiriLoom <orders@example.com>",
    );
    const known = await requestPasswordReset(email, { ip: "203.0.113.41", appUrl: APP, mailer });
    const unknownMail: string[] = [];
    const unknown = await requestPasswordReset(nextEmail(), {
      ip: "203.0.113.42",
      appUrl: APP,
      mailer: { async sendPasswordReset(message) { unknownMail.push(message.to); } },
    });
    assert.equal(known.message, unknown.message);
    assert.equal(unknownMail.length, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.to, email);
    assert.equal(sent[0]?.from, "KashmiriLoom <orders@example.com>");
    assert.match(sent[0]?.text ?? "", /https:\/\/shop\.example\/reset-password\?token=/);
    const token = new URL(sent[0]?.text.match(/https:\/\/shop\.example\/reset-password\?token=([A-Za-z0-9_-]+)/)?.[0] ?? APP).searchParams.get("token");
    assert.ok(token);
    const stored = await PasswordReset.findOne({ tokenHash: hashSecret(token) }).lean<{ tokenHash: string } | null>();
    assert.equal(stored?.tokenHash, hashSecret(token));
    assert.equal(JSON.stringify(stored).includes(token), false);
    const bombing: string[] = [];
    const bombMailer: Mailer = { async sendPasswordReset() { bombing.push("sent"); } };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await requestPasswordReset(email, { ip: `198.51.100.${attempt + 20}`, appUrl: APP, mailer: bombMailer });
    }
    const blockedReset = await requestPasswordReset(email, { ip: "198.51.100.30", appUrl: APP, mailer: bombMailer });
    assert.match(blockedReset.message, /wait/i);
    assert.equal(bombing.length, 4);
  });

  test("rejects expired and reused reset tokens and invalidates sessions", async () => {
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.50" });
    const sent: string[] = [];
    const mailer: Mailer = { async sendPasswordReset(message) { sent.push(message.resetUrl); } };
    await requestPasswordReset(email, { ip: "203.0.113.51", appUrl: APP, mailer });
    const token = new URL(sent[0] ?? APP).searchParams.get("token") ?? "";
    const signedIn = await loginCustomer({ email, password: PASSWORD }, { ip: "203.0.113.52" });
    assert.equal(signedIn.ok, true);
    if (!signedIn.ok) {
      return;
    }
    const expired = await resetCustomerPassword(
      { token, password: "newer-password-1" },
      { ip: "203.0.113.53", now: Date.now() + 31 * 60 * 1000 },
    );
    assert.equal(expired.ok, false);
    assert.ok(await customerFromSessionToken(signedIn.token));
    const reset = await resetCustomerPassword({ token, password: "newer-password-1" }, { ip: "203.0.113.54" });
    assert.equal(reset.ok, true);
    assert.equal(await customerFromSessionToken(signedIn.token), null);
    const reused = await resetCustomerPassword({ token, password: "third-password-1" }, { ip: "203.0.113.55" });
    assert.equal(reused.ok, false);
    const oldPassword = await loginCustomer({ email, password: PASSWORD }, { ip: "203.0.113.56" });
    const newPassword = await loginCustomer({ email, password: "newer-password-1" }, { ip: "203.0.113.57" });
    assert.equal(oldPassword.ok, false);
    assert.equal(newPassword.ok, true);

    const again = nextEmail();
    await registerCustomer({ name: "Amina Shah", email: again, password: PASSWORD }, { ip: "203.0.113.58" });
    const issued: string[] = [];
    const issuing: Mailer = { async sendPasswordReset(message) { issued.push(message.resetUrl); } };
    await requestPasswordReset(again, { ip: "203.0.113.90", appUrl: APP, mailer: issuing });
    await requestPasswordReset(again, { ip: "203.0.113.91", appUrl: APP, mailer: issuing });
    const firstToken = new URL(issued[0] ?? APP).searchParams.get("token") ?? "";
    const secondToken = new URL(issued[1] ?? APP).searchParams.get("token") ?? "";
    const superseded = await resetCustomerPassword({ token: firstToken, password: "second-password-1" }, { ip: "203.0.113.92" });
    assert.equal(superseded.ok, false);
    const holder = await Customer.findOne({ email: again }).select("_id").lean<{ _id: Types.ObjectId } | null>();
    const racedToken = createSecretToken();
    await PasswordReset.create({
      tokenHash: hashSecret(racedToken),
      customerId: holder?._id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const current = await resetCustomerPassword({ token: secondToken, password: "second-password-1" }, { ip: "203.0.113.93" });
    assert.equal(current.ok, true);
    const raced = await resetCustomerPassword({ token: racedToken, password: "third-password-9" }, { ip: "203.0.113.94" });
    assert.equal(raced.ok, false);
  });

  test("uses secure customer session cookies and sign-out removes the server session", async () => {
    const production = customerCookieOptions("production");
    const development = customerCookieOptions("development");
    assert.equal(production.httpOnly, true);
    assert.equal(production.secure, true);
    assert.equal(production.sameSite, "lax");
    assert.equal(development.secure, false);
    assert.notEqual(CUSTOMER_COOKIE_NAME, ADMIN_COOKIE_NAME);
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.60" });
    const signedIn = await loginCustomer({ email, password: PASSWORD }, { ip: "203.0.113.61" });
    assert.equal(signedIn.ok, true);
    if (!signedIn.ok) {
      return;
    }
    await destroyCustomerSession(signedIn.token);
    assert.equal(await customerFromSessionToken(signedIn.token), null);
    assert.equal(await CustomerSession.countDocuments({ tokenHash: hashSecret(signedIn.token) }), 0);
  });

  test("keeps guest checkout private and attaches a signed-in customer only from the server", async () => {
    const guest = await createGuestOrder(orderInput());
    assert.equal(guest.ok, true);
    if (!guest.ok) {
      return;
    }
    const hidden = await readPublicOrder(guest.reference, undefined);
    assert.equal(hidden?.contact, null);
    assert.equal(hidden?.address, null);
    const buyer = await registerCustomer({ name: "Amina Shah", email: nextEmail(), password: PASSWORD }, { ip: "203.0.113.70" });
    const other = await registerCustomer({ name: "Yusuf Dar", email: nextEmail(), password: PASSWORD }, { ip: "203.0.113.71" });
    assert.equal(buyer.ok, true);
    assert.equal(other.ok, true);
    if (!buyer.ok || !other.ok) {
      return;
    }
    const ignored = await createGuestOrder({ ...orderInput(), customerId: other.customerId });
    assert.equal(ignored.ok, true);
    if (!ignored.ok) {
      return;
    }
    const ignoredOrder = await Order.findOne({ publicReference: ignored.reference }).select("customerId").lean<{ customerId?: unknown } | null>();
    assert.equal(ignoredOrder?.customerId, undefined);
    const owned = await createGuestOrder(orderInput(), { customerId: buyer.customerId });
    assert.equal(owned.ok, true);
    if (!owned.ok) {
      return;
    }
    const history = await listOwnedOrders(buyer.customerId, 1);
    assert.equal(history.orders.some((order) => order.reference === owned.reference), true);
    assert.equal(await readOwnedOrder(other.customerId, owned.reference), null);
    assert.ok(await readOwnedOrder(buyer.customerId, owned.reference));
    const otherHistory = await listOwnedOrders(other.customerId, 1);
    assert.equal(otherHistory.orders.some((order) => order.reference === owned.reference), false);
  });

  test("keeps admin password checks separate and blocks unsafe return paths", async () => {
    const adminHash = await hashPassword("admin-password-ok");
    assert.equal(adminHash.startsWith("$2"), true);
    assert.equal(await passwordsMatch("admin-password-ok", adminHash), true);
    assert.equal(safeNextPath("https://evil.example"), "/account");
    assert.equal(safeNextPath("//evil.example"), "/account");
    assert.equal(safeNextPath("/checkout"), "/checkout");
    const url = googleAuthorizationUrl({
      clientId: "google-client-test",
      redirectUri: "https://shop.example/auth/callback/google",
      state: "state-value",
      codeVerifier: "v".repeat(43),
    });
    assert.equal(url.searchParams.get("client_secret"), null);
    const exchanged = await exchangeGoogleAuthorizationCode(
      {
        code: "auth-code",
        codeVerifier: "v".repeat(43),
        clientId: "google-client-test",
        clientSecret: "google-client-secret",
        redirectUri: "https://shop.example/auth/callback/google",
      },
      async () => new Response(JSON.stringify({ id_token: "header.payload.signature" })),
    );
    assert.equal(exchanged, "header.payload.signature");
    assert.equal(normalizeEmail("  Ada@Example.com "), "ada@example.com");
    assert.equal(authRedirectUrl(null, "/login?error=cancelled"), "/login?error=cancelled");
    assert.equal(authRedirectUrl("https://shop.example", "/account"), "https://shop.example/account");
    assert.equal(authRedirectUrl("https://shop.example", "//evil.example").startsWith("https://shop.example/"), true);
  });

  test("does not keep or log a reset token when email sending fails", async () => {
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.95" });
    let leaked = "";
    const mailer: Mailer = {
      async sendPasswordReset(message) {
        leaked = message.resetUrl;
        throw new Error(`provider rejected ${message.resetUrl}`);
      },
    };
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    try {
      const result = await requestPasswordReset(email, { ip: "203.0.113.96", appUrl: APP, mailer });
      assert.match(result.message, /If an account exists/);
    } finally {
      console.error = original;
    }
    const token = new URL(leaked).searchParams.get("token") ?? "";
    assert.equal(token.length > 0, true);
    assert.equal(logged.some((line) => line.includes(token)), false);
    assert.equal(await PasswordReset.countDocuments({ tokenHash: hashSecret(token) }), 0);
  });

  test("keeps one address bucket when the forwarding header changes", () => {
    const first = clientAddress(new Headers({ "x-forwarded-for": "203.0.113.8" }), {});
    const second = clientAddress(new Headers({ "x-forwarded-for": "198.51.100.8, 203.0.113.9" }), {});
    assert.equal(first, "unknown");
    assert.equal(second, "unknown");
    const trusted = clientAddress(
      new Headers({ "x-forwarded-for": "203.0.113.8", "x-vercel-forwarded-for": "198.51.100.50" }),
      { VERCEL: "1" },
    );
    assert.equal(trusted, "198.51.100.50");
    const listed = clientAddress(
      new Headers({ "x-vercel-forwarded-for": "203.0.113.8, 198.51.100.50", "x-real-ip": "192.0.2.10" }),
      { VERCEL: "1" },
    );
    assert.equal(listed, "192.0.2.10");
    assert.equal(clientAddress(new Headers({ "x-real-ip": "203.0.113.8" }), {}), "unknown");
  });

  test("limits different emails that share one address, and still separates the email counters", async () => {
    const first = nextEmail();
    const second = nextEmail();
    await registerCustomer({ name: "Amina Shah", email: first, password: PASSWORD }, { ip: "203.0.113.120" });
    await registerCustomer({ name: "Yusuf Dar", email: second, password: PASSWORD }, { ip: "203.0.113.121" });
    resetCustomerAuthLimits();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await loginCustomer({ email: first, password: "wrong-password-1" }, { ip: "192.0.2.40" });
      assert.equal(failed.ok, false);
    }
    const sharedAddress = await loginCustomer({ email: second, password: PASSWORD }, { ip: "192.0.2.40" });
    assert.equal(sharedAddress.ok, false);
    const separateEmail = await loginCustomer({ email: second, password: PASSWORD }, { ip: "192.0.2.41" });
    assert.equal(separateEmail.ok, true);
  });

  test("lets only the configured number of concurrent attempts through one counter", async () => {
    const policy = customerAuthPolicy();
    const orderPolicy = orderSubmitPolicy();
    let calls = 0;
    const counts = new Map<string, number>();
    useRateLimitStore(
      redisCounterStore({
        async eval(script, keys, args) {
          calls += 1;
          assert.match(script, /INCR/);
          assert.match(script, /PEXPIRE/);
          assert.equal(keys.length, 1);
          assert.equal(Number(args[0]), policy.windowMs);
          const next = (counts.get(keys[0] ?? "") ?? 0) + 1;
          counts.set(keys[0] ?? "", next);
          return next;
        },
      }),
    );
    const now = 1_700_000_000_000;
    const attempts = policy.max + 3;
    const results = await Promise.all(Array.from({ length: attempts }, () => consumeLimit(["burst"], policy, now)));
    assert.equal(results.filter((result) => result === "ok").length, policy.max);
    assert.equal(results.filter((result) => result === "limited").length, 3);
    assert.equal(calls, attempts);
    const later = await consumeLimit(["burst"], policy, now + policy.windowMs);
    assert.equal(later, "limited");
    useMemoryRateLimits();
    resetCustomerAuthLimits();
    const expired = await consumeLimit(["burst"], policy, now + policy.windowMs);
    assert.equal(expired, "ok");
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.130" });
    const signIns = await Promise.all(
      Array.from({ length: attempts }, () => loginCustomer({ email, password: "wrong-password-1" }, { ip: "192.0.2.77" })),
    );
    assert.equal(signIns.filter((result) => !result.ok && result.message === "The email or password is not correct.").length, policy.max);
    assert.equal(signIns.filter((result) => !result.ok && /wait/i.test(result.message)).length, 3);
    const submissions = await Promise.all(
      Array.from({ length: orderPolicy.max + 2 }, () => orderSubmitAllowed("192.0.2.80", now)),
    );
    assert.equal(submissions.filter(Boolean).length, orderPolicy.max);
    assert.equal(submissions.filter((allowed) => !allowed).length, 2);
  });

  test("refuses authentication when the shared counter is missing or Redis fails", async () => {
    assert.equal(readUpstashConfig({}), null);
    assert.equal(readUpstashConfig({ UPSTASH_REDIS_REST_URL: "http://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "x".repeat(24) }), null);
    const email = nextEmail();
    await registerCustomer({ name: "Amina Shah", email, password: PASSWORD }, { ip: "203.0.113.140" });
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    try {
      useRateLimitStore(unconfiguredRateLimitStore());
      const missing = await loginCustomer({ email, password: PASSWORD }, { ip: "192.0.2.90" });
      assert.equal(missing.ok, false);
      if (!missing.ok) {
        assert.match(missing.message, /wait/i);
        assert.notEqual(missing.message, "The email or password is not correct.");
      }
      useRateLimitStore({
        async increment() {
          throw new Error("UPSTASH_REDIS_REST_TOKEN=super-secret-token refused");
        },
      });
      resetCustomerAuthLimits();
      const failed = await loginCustomer({ email, password: PASSWORD }, { ip: "192.0.2.91" });
      assert.equal(failed.ok, false);
      if (!failed.ok) {
        assert.match(failed.message, /wait/i);
      }
    } finally {
      console.error = original;
    }
    assert.equal(logged.some((line) => line.includes("super-secret-token")), false);
    assert.equal(await CustomerSession.countDocuments({ customerId: (await Customer.findOne({ email }).select("_id"))?._id }), 0);
    useMemoryRateLimits();
    resetCustomerAuthLimits();
    const restored = await loginCustomer({ email, password: PASSWORD }, { ip: "192.0.2.92" });
    assert.equal(restored.ok, true);
  });
});

function identity(sub: string, email: string, audience: string, now: number) {
  return {
    sub,
    email,
    emailVerified: true as const,
    audience,
    issuer: "https://accounts.google.com",
    expiresAt: Math.floor(now / 1000) + 300,
    name: "Amina Shah",
  };
}

function nextEmail() {
  sequence += 1;
  return `customer${sequence}@customer.test`;
}

function orderInput() {
  return {
    idempotencyKey: crypto.randomUUID(),
    lines: [{ slug: "phase-customer-shawl", quantity: 1 }],
    contact: { name: "Phase Guest", email: "guest@customer.test", phone: "9876543210" },
    address: {
      line1: "12 Test Lane",
      line2: "",
      city: "Srinagar",
      state: "Jammu and Kashmir" as const,
      postalCode: "190001",
      country: "IN" as const,
    },
  };
}

async function cleanup() {
  const customers = await Customer.find({ email: /@customer\.test$/ }).select("_id").lean<Array<{ _id: Types.ObjectId }>>();
  const ids = customers.map((customer) => customer._id);
  await PasswordReset.deleteMany({ customerId: { $in: ids } });
  await CustomerSession.deleteMany({ customerId: { $in: ids } });
  await Order.deleteMany({ "lines.sku": SKU });
  await Customer.deleteMany({ email: /@customer\.test$/ });
}
