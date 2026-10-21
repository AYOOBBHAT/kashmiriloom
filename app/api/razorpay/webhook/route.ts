import { revalidatePath } from "next/cache";
import { receiveWebhook } from "@/lib/payments/service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await receiveWebhook({
    rawBody,
    signature: request.headers.get("x-razorpay-signature") ?? "",
    eventId: request.headers.get("x-razorpay-event-id") ?? "",
  });
  if (result.status === 200 && !result.duplicate) {
    revalidatePath("/shop");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
  }
  return new Response(null, { status: result.status });
}
