import "server-only";

import mongoose, { type ClientSession } from "mongoose";

/**
 * Atlas clusters are replica sets, so multi-document transactions are available.
 * Stock changes and the order write then commit or abort together.
 * A standalone mongod rejects transactions. The caller falls back to conditional
 * updates and puts reserved quantity back if a later step fails.
 */
export async function runOrderTransaction<T>(
  work: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  let session: ClientSession;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (error) {
    if (transactionsUnsupported(error)) {
      return work(null);
    }
    throw error;
  }

  try {
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export function transactionsUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /replica set|mongos|Transaction numbers are only allowed/i.test(message);
}

export function isRetryableTransaction(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  if ("code" in error && (error.code === 112 || error.code === 251)) {
    return true;
  }
  if (
    "errorLabels" in error &&
    Array.isArray(error.errorLabels) &&
    error.errorLabels.some((label) => label === "TransientTransactionError" || label === "UnknownTransactionCommitResult")
  ) {
    return true;
  }
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return /WriteConflict|TransientTransactionError/i.test(message);
}

export function duplicateKeyField(error: unknown): string | null {
  const direct = duplicateFrom(error);
  if (direct) {
    return direct;
  }
  if (error && typeof error === "object" && "cause" in error) {
    return duplicateFrom(error.cause);
  }
  return null;
}

function duplicateFrom(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) {
    return null;
  }
  const pattern =
    "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object"
      ? error.keyPattern
      : "keyValue" in error && error.keyValue && typeof error.keyValue === "object"
        ? error.keyValue
        : {};
  const field = Object.keys(pattern)[0];
  if (field) {
    return field;
  }
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const match = message.match(/index:\s(?:\w+\.)?\$?(\w+)_1/);
  return match?.[1] ?? "unknown";
}
