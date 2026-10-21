import { createHash } from "node:crypto";
import { MAX_BAG_QUANTITY } from "@/lib/bag";
import { isIndianState, type IndianState } from "@/lib/orders/address";

const MAX_LINES = 8;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[\p{L}][\p{L} .'-]{1,79}$/u;
const CITY = /^[\p{L}][\p{L} .'-]{1,59}$/u;

export type CheckoutLine = {
  slug: string;
  quantity: number;
};

export type CheckoutContact = {
  name: string;
  email: string;
  phone: string;
};

export type CheckoutAddress = {
  line1: string;
  line2: string;
  city: string;
  state: IndianState;
  postalCode: string;
  country: "IN";
};

export type CheckoutDraft = {
  idempotencyKey: string;
  lines: CheckoutLine[];
  contact: CheckoutContact;
  address: CheckoutAddress;
  fingerprint: string;
};

export type CheckoutFields = Record<string, string>;

export type CheckoutValidation =
  | { ok: true; draft: CheckoutDraft }
  | { ok: false; message: string; fields: CheckoutFields };

export function validateCheckout(input: unknown): CheckoutValidation {
  const source = isRecord(input) ? input : {};
  const fields: CheckoutFields = {};
  const idempotencyKey = typeof source.idempotencyKey === "string" ? source.idempotencyKey.trim() : "";
  if (!UUID.test(idempotencyKey)) {
    fields.idempotencyKey = "Refresh the page, then place the order again.";
  }

  const lines = readLines(source.lines, fields);
  const contact = readContact(source.contact, fields);
  const address = readAddress(source.address, fields);

  if (!lines || !contact || !address || fields.idempotencyKey) {
    return {
      ok: false,
      message: "Check the details below and try again.",
      fields,
    };
  }

  const draft: CheckoutDraft = { idempotencyKey: idempotencyKey.toLowerCase(), lines, contact, address, fingerprint: "" };
  draft.fingerprint = checkoutFingerprint(draft);
  return { ok: true, draft };
}

export function checkoutFingerprint(draft: Omit<CheckoutDraft, "fingerprint">): string {
  const body = JSON.stringify({
    lines: draft.lines.map((line) => ({ slug: line.slug, quantity: line.quantity })),
    contact: draft.contact,
    address: draft.address,
  });
  return createHash("sha256").update(body).digest("hex");
}

function readLines(value: unknown, fields: CheckoutFields): CheckoutLine[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    fields.lines = "Add a shawl before placing an order.";
    return null;
  }
  if (value.length > MAX_LINES) {
    fields.lines = "The bag has too many shawls to check out together.";
    return null;
  }
  const lines: CheckoutLine[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const record = isRecord(item) ? item : {};
    const slug = typeof record.slug === "string" ? record.slug.trim().toLowerCase() : "";
    const quantity = readQuantity(record.quantity);
    if (!SLUG.test(slug) || slug.length > 80) {
      fields.lines = "A shawl in this bag is not available.";
      return null;
    }
    if (seen.has(slug)) {
      fields.lines = "Each shawl can appear once.";
      return null;
    }
    if (quantity === null || quantity < 1 || quantity > MAX_BAG_QUANTITY) {
      fields.lines = `Quantity must be a whole number from 1 to ${MAX_BAG_QUANTITY}.`;
      return null;
    }
    seen.add(slug);
    lines.push({ slug, quantity });
  }
  return lines;
}

function readQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function readContact(value: unknown, fields: CheckoutFields): CheckoutContact | null {
  const record = isRecord(value) ? value : {};
  const name = readText(record.name);
  const email = readText(record.email).toLowerCase();
  const phone = normalizePhone(readText(record.phone));
  if (!NAME.test(name)) {
    fields.name = "Enter the name for this delivery.";
  }
  if (email.length > 120 || !EMAIL.test(email)) {
    fields.email = "Enter a valid email address.";
  }
  if (!phone) {
    fields.phone = "Enter a 10-digit Indian mobile number.";
  }
  if (fields.name || fields.email || fields.phone || !phone) {
    return null;
  }
  return { name, email, phone };
}

function readAddress(value: unknown, fields: CheckoutFields): CheckoutAddress | null {
  const record = isRecord(value) ? value : {};
  const line1 = readText(record.line1);
  const line2 = readText(record.line2);
  const city = readText(record.city);
  const state = readText(record.state);
  const postalCode = readText(record.postalCode);
  const country = readText(record.country);
  if (line1.length < 3 || line1.length > 120) {
    fields.line1 = "Enter the street address.";
  }
  if (line2.length > 120) {
    fields.line2 = "The second address line is too long.";
  }
  if (!CITY.test(city)) {
    fields.city = "Enter the city.";
  }
  if (!isIndianState(state)) {
    fields.state = "Choose an Indian state or union territory.";
  }
  if (!/^[1-9][0-9]{5}$/.test(postalCode)) {
    fields.postalCode = "Enter a 6-digit PIN code.";
  }
  if (country !== "IN") {
    fields.country = "Delivery is within India.";
  }
  if (fields.line1 || fields.line2 || fields.city || fields.state || fields.postalCode || fields.country) {
    return null;
  }
  if (!isIndianState(state)) {
    return null;
  }
  return { line1, line2, city, state, postalCode, country: "IN" };
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9][0-9]{9}$/.test(local)) {
    return null;
  }
  return local;
}

function readText(value: unknown): string {
  if (typeof value !== "string" || /[\u0000-\u001F\u007F]/.test(value)) {
    return "";
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
