export type CloudinaryUsageSummary = {
  plan: string | null;
  storageUsed: number | null;
  storageLimit: number | null;
  transformationsUsed: number | null;
  transformationsLimit: number | null;
  bandwidthUsed: number | null;
  bandwidthLimit: number | null;
  creditsUsed: number | null;
  creditsLimit: number | null;
  objectsUsed: number | null;
  objectsLimit: number | null;
};

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readLimit(entry: unknown): { usage: number | null; limit: number | null } {
  if (!entry || typeof entry !== "object") {
    return { usage: null, limit: null };
  }
  const record = entry as { usage?: unknown; limit?: unknown };
  return { usage: readNumber(record.usage), limit: readNumber(record.limit) };
}

/** Keeps the usage response to counts. Account secrets are not part of this shape. */
export function summarizeCloudinaryUsage(payload: unknown): CloudinaryUsageSummary | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const storage = readLimit(record.storage);
  const transformations = readLimit(record.transformations);
  const bandwidth = readLimit(record.bandwidth);
  const credits = readLimit(record.credits);
  const objects = readLimit(record.objects);
  return {
    plan: typeof record.plan === "string" ? record.plan : null,
    storageUsed: storage.usage,
    storageLimit: storage.limit,
    transformationsUsed: transformations.usage,
    transformationsLimit: transformations.limit,
    bandwidthUsed: bandwidth.usage,
    bandwidthLimit: bandwidth.limit,
    creditsUsed: credits.usage,
    creditsLimit: credits.limit,
    objectsUsed: objects.usage,
    objectsLimit: objects.limit,
  };
}
