import "server-only";

import { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { CatalogueAccessError, redactSecrets } from "@/lib/catalogue-error";
import { isPaise } from "@/lib/money";
import { connectToDatabase } from "@/lib/mongodb";
import { Customer } from "@/lib/models/customer";
import { Order, type FulfilmentStatus, type OrderLineRecord } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { approvedCharges } from "@/lib/orders/charges";
import { createPublicReference, createViewToken, hashViewToken } from "@/lib/orders/reference";
import {
  duplicateKeyField,
  isRetryableTransaction,
  runOrderTransaction,
  transactionsUnsupported,
} from "@/lib/orders/transaction";
import { validateCheckout, type CheckoutDraft, type CheckoutFields } from "@/lib/orders/validate";
import { paymentExpiresAt } from "@/lib/payments/status";

const SAVE_FAILED = "The order could not be saved. Nothing was reserved. You can try again.";

export type CreateOrderResult =
  | { ok: true; reference: string; viewToken: string }
  | { ok: false; code: "validation" | "stock" | "mismatch" | "unavailable"; message: string; fields: CheckoutFields };

type PricedLine = OrderLineRecord;

type PlaceOutcome =
  | { type: "created"; reference: string; viewToken: string }
  | { type: "replay"; fingerprint: string; reference: string }
  | { type: "rejected"; message: string; fields: CheckoutFields; code: "stock" | "validation" };

class StockConflict extends Error {
  readonly productName: string;

  constructor(productName: string) {
    super("stock");
    this.name = "StockConflict";
    this.productName = productName;
  }
}

export async function createGuestOrder(
  input: unknown,
  options?: { reservation?: "transaction" | "sequential"; customerId?: string },
): Promise<CreateOrderResult> {
  const parsed = validateCheckout(input);
  if (!parsed.ok) {
    return { ok: false, code: "validation", message: parsed.message, fields: parsed.fields };
  }

  try {
    await connectToDatabase();
    const owner = await customerOwner(options?.customerId);
    const mode = options?.reservation ?? "transaction";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const outcome =
          mode === "sequential"
            ? await place(parsed.draft, null, owner)
            : await runOrderTransaction((session) => place(parsed.draft, session, owner));
        if (outcome.type === "rejected") {
          return { ok: false, code: outcome.code, message: outcome.message, fields: outcome.fields };
        }
        if (outcome.type === "replay") {
          return replay(parsed.draft, outcome.reference, outcome.fingerprint);
        }
        return { ok: true, reference: outcome.reference, viewToken: outcome.viewToken };
      } catch (error) {
        if (mode === "transaction" && transactionsUnsupported(error)) {
          const outcome = await place(parsed.draft, null, owner);
          if (outcome.type === "rejected") {
            return { ok: false, code: outcome.code, message: outcome.message, fields: outcome.fields };
          }
          if (outcome.type === "replay") {
            return replay(parsed.draft, outcome.reference, outcome.fingerprint);
          }
          return { ok: true, reference: outcome.reference, viewToken: outcome.viewToken };
        }
        const duplicate = duplicateKeyField(error);
        if (duplicate === "publicReference" && attempt < 2) {
          continue;
        }
        if (duplicate === "idempotencyKey") {
          const existing = await Order.findOne({ idempotencyKey: parsed.draft.idempotencyKey })
            .select("publicReference fingerprint")
            .lean<{ publicReference: string; fingerprint: string } | null>();
          if (existing) {
            return replay(parsed.draft, existing.publicReference, existing.fingerprint);
          }
        }
        if (error instanceof StockConflict) {
          return {
            ok: false,
            code: "stock",
            message: `Not enough of ${error.productName} is available, so nothing was reserved.`,
            fields: { lines: `Not enough of ${error.productName} is available.` },
          };
        }
        if (isRetryableTransaction(error) && attempt < 2 && mode === "transaction") {
          continue;
        }
        return unavailable(error);
      }
    }
    return { ok: false, code: "unavailable", message: SAVE_FAILED, fields: {} };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      return { ok: false, code: "unavailable", message: error.message, fields: {} };
    }
    return unavailable(error);
  }
}

async function place(
  draft: CheckoutDraft,
  session: ClientSession | null,
  customerId?: Types.ObjectId,
): Promise<PlaceOutcome> {
  const existing = await Order.findOne({ idempotencyKey: draft.idempotencyKey })
    .session(session)
    .select("publicReference fingerprint")
    .lean<{ publicReference: string; fingerprint: string } | null>();
  if (existing) {
    return { type: "replay", reference: existing.publicReference, fingerprint: existing.fingerprint };
  }

  const priced = await priceLines(draft, session);
  if (!priced.ok) {
    return { type: "rejected", code: "stock", message: priced.message, fields: { lines: priced.message } };
  }

  let reserved: PricedLine[] = [];
  try {
    reserved = await reserve(priced.lines, session);
    const viewToken = createViewToken();
    const charges = approvedCharges();
    const subtotalPaise = priced.lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
    const totalPaise = subtotalPaise + charges.shippingPaise + charges.taxPaise;
    if (!isPaise(subtotalPaise) || !isPaise(totalPaise)) {
      throw new Error("Order total is outside the catalogue range.");
    }
    const reference = await insertOrder(
      draft,
      priced.lines,
      viewToken,
      subtotalPaise,
      charges,
      totalPaise,
      session,
      customerId,
    );
    return { type: "created", reference, viewToken };
  } catch (error) {
    if (!session && reserved.length > 0) {
      await restore(reserved, null);
    }
    throw error;
  }
}

async function priceLines(
  draft: CheckoutDraft,
  session: ClientSession | null,
): Promise<{ ok: true; lines: PricedLine[] } | { ok: false; message: string }> {
  const slugs = draft.lines.map((line) => line.slug);
  const docs = await Product.find({ slug: { $in: slugs } })
    .session(session)
    .select("name slug sku pricePaise active currency")
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        slug: string;
        sku: string;
        pricePaise: number;
        active: boolean;
        currency: string;
      }>
    >();
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  const lines: PricedLine[] = [];
  for (const requested of draft.lines) {
    const product = bySlug.get(requested.slug);
    if (!product || product.active !== true || product.currency !== "INR" || !isPaise(product.pricePaise)) {
      const name = product?.name ? product.name : "A shawl in this bag";
      return { ok: false, message: `${name} is not available, so nothing was reserved.` };
    }
    lines.push({
      productId: product._id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      quantity: requested.quantity,
      unitPricePaise: product.pricePaise,
    });
  }
  return { ok: true, lines };
}

async function reserve(lines: PricedLine[], session: ClientSession | null): Promise<PricedLine[]> {
  const reserved: PricedLine[] = [];
  const sorted = [...lines].sort((left, right) => String(left.productId).localeCompare(String(right.productId)));
  try {
    for (const line of sorted) {
      const updated = await Product.findOneAndUpdate(
        { _id: line.productId, active: true, stockQuantity: { $gte: line.quantity } },
        { $inc: { stockQuantity: -line.quantity } },
        { session: session ?? undefined, returnDocument: "before" },
      );
      if (!updated) {
        throw new StockConflict(line.name);
      }
      reserved.push(line);
    }
    return reserved;
  } catch (error) {
    if (!session && reserved.length > 0) {
      await restore(reserved, null);
    }
    throw error;
  }
}

async function restore(lines: PricedLine[], session: ClientSession | null): Promise<void> {
  for (const line of lines) {
    await Product.updateOne(
      { _id: line.productId },
      { $inc: { stockQuantity: line.quantity } },
      { session: session ?? undefined },
    );
  }
}

async function insertOrder(
  draft: CheckoutDraft,
  lines: PricedLine[],
  viewToken: string,
  subtotalPaise: number,
  charges: { shippingPaise: number; taxPaise: number },
  totalPaise: number,
  session: ClientSession | null,
  customerId?: Types.ObjectId,
): Promise<string> {
  const publicReference = createPublicReference();
  await Order.create(
    [
      {
        publicReference,
        idempotencyKey: draft.idempotencyKey,
        fingerprint: draft.fingerprint,
        viewTokenHash: hashViewToken(viewToken),
        lines,
        contact: draft.contact,
        address: draft.address,
        subtotalPaise,
        shippingPaise: charges.shippingPaise,
        taxPaise: charges.taxPaise,
        totalPaise,
        currency: "INR",
        paymentStatus: "pending",
        fulfilmentStatus: "pending" satisfies FulfilmentStatus,
        paymentExpiresAt: paymentExpiresAt(),
        ...(customerId ? { customerId } : {}),
      },
    ],
    session ? { session } : undefined,
  );
  return publicReference;
}

async function replay(draft: CheckoutDraft, reference: string, fingerprint: string): Promise<CreateOrderResult> {
  if (fingerprint !== draft.fingerprint) {
    return {
      ok: false,
      code: "mismatch",
      message: "This checkout was already used for a different order. Refresh the page and start again.",
      fields: {},
    };
  }
  const viewToken = createViewToken();
  await Order.updateOne({ publicReference: reference }, { $set: { viewTokenHash: hashViewToken(viewToken) } });
  return { ok: true, reference, viewToken };
}

async function customerOwner(customerId: string | undefined): Promise<Types.ObjectId | undefined> {
  if (!customerId || !isValidObjectId(customerId)) {
    return undefined;
  }
  const customer = await Customer.findById(customerId).select("_id").lean<{ _id: Types.ObjectId } | null>();
  return customer?._id;
}

function unavailable(error: unknown): CreateOrderResult {
  if (error instanceof CatalogueAccessError) {
    return { ok: false, code: "unavailable", message: error.message, fields: {} };
  }
  const detail = error instanceof Error ? error.message : "Unknown database error";
  console.error(`Order creation failed: ${redactSecrets(detail)}`);
  return { ok: false, code: "unavailable", message: SAVE_FAILED, fields: {} };
}
