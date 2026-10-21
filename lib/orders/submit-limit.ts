import { orderSubmitPolicy } from "@/lib/rate-limit/policy";
import { consumeLimit } from "@/lib/rate-limit/shared";

export async function orderSubmitAllowed(ip: string, now = Date.now()): Promise<boolean> {
  const outcome = await consumeLimit([`order:${ip}`], orderSubmitPolicy(), now);
  return outcome === "ok";
}
