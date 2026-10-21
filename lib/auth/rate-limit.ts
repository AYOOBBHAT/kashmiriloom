const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function clientAddress(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  if (env.VERCEL !== "1") {
    return "unknown";
  }
  const platform = singleIp(headers.get("x-vercel-forwarded-for"));
  if (platform) {
    return platform;
  }
  return singleIp(headers.get("x-real-ip")) ?? "unknown";
}

function singleIp(value: string | null): string | null {
  const candidate = value?.trim().toLowerCase() ?? "";
  if (!candidate || candidate.length > 45 || /[\s,]/.test(candidate)) {
    return null;
  }
  if (IPV4.test(candidate)) {
    return candidate;
  }
  if (!candidate.includes(":") || candidate.includes("%")) {
    return null;
  }
  const halves = candidate.split("::");
  if (halves.length > 2) {
    return null;
  }
  const groups = candidate.split(":").filter((part) => part.length > 0);
  if (groups.length === 0 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  const width = candidate.split(":").length;
  if (candidate.includes("::")) {
    return width <= 8 ? candidate : null;
  }
  return width === 8 ? candidate : null;
}
