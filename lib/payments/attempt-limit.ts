import { paymentAttemptPolicy } from "@/lib/rate-limit/policy";
import { consumeLimit } from "@/lib/rate-limit/shared";

const LIMITED = "Please wait a few minutes before trying payment again.";
const UNAVAILABLE = "This request cannot be completed right now. Please try again in a few minutes.";

export async function paymentAttemptStatus(
  action: "prepare" | "confirm",
  ip: string,
  now = Date.now(),
): Promise<string | null> {
  const outcome = await consumeLimit([`payment-${action}:${ip}`], paymentAttemptPolicy(), now);
  if (outcome.decision === "ok") {
    return null;
  }
  return outcome.decision === "limited" ? LIMITED : UNAVAILABLE;
}
