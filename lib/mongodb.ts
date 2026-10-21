import "server-only";

import mongoose from "mongoose";
import {
  CatalogueAccessError,
  MISSING_URI_MESSAGE,
  UNAVAILABLE_MESSAGE,
  redactSecrets,
} from "@/lib/catalogue-error";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __kashmiriloomMongoose?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.__kashmiriloomMongoose ?? {
  conn: null,
  promise: null,
};

globalForMongoose.__kashmiriloomMongoose = cache;

function uriNamesDatabase(uri: string): boolean {
  const withoutProtocol = uri.replace(/^mongodb(?:\+srv)?:\/\//i, "");
  const slash = withoutProtocol.indexOf("/");
  if (slash === -1) {
    return false;
  }
  const path = withoutProtocol.slice(slash + 1).split("?")[0] ?? "";
  return path.length > 0;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new CatalogueAccessError("missing-uri", MISSING_URI_MESSAGE);
  }
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new CatalogueAccessError(
      "missing-uri",
      "MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string. See .env.example. The value is not shown here.",
    );
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8_000,
        maxPoolSize: 10,
        ...(uriNamesDatabase(uri) ? {} : { dbName: "kashmiriloom" }),
      })
      .then((connected) => {
        cache.conn = connected;
        return connected;
      })
      .catch((error: unknown) => {
        cache.promise = null;
        const detail = error instanceof Error ? error.message : "Unknown database error";
        console.error(`Catalogue database error: ${redactSecrets(detail)}`);
        throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
      });
  }

  return cache.promise;
}

export async function disconnectDatabase(): Promise<void> {
  cache.promise = null;
  const connected = cache.conn;
  cache.conn = null;
  if (!connected) {
    return;
  }
  await connected.disconnect();
}
