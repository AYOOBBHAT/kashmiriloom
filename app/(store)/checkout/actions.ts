"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { clientAddress } from "@/lib/auth/rate-limit";
import { createGuestOrder } from "@/lib/orders/create";
import { orderSubmitAllowed, recordOrderSubmit } from "@/lib/orders/submit-limit";
import { ORDER_VIEW_COOKIE, orderViewCookieOptions, packViewCookie } from "@/lib/orders/view-cookie";
import type { CheckoutFields } from "@/lib/orders/validate";

export type PlaceOrderState = {
  message: string;
  fields: CheckoutFields;
  reference: string;
  code: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function placeOrder(
  _previous: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  await connection();
  const addressKey = clientAddress(await headers());
  if (!orderSubmitAllowed(addressKey)) {
    return {
      message: "Please wait a few minutes before placing another order.",
      fields: {},
      reference: "",
      code: "unavailable",
    };
  }
  recordOrderSubmit(addressKey);

  const slugs = formData.getAll("slug");
  const quantities = formData.getAll("quantity");
  const result = await createGuestOrder({
    idempotencyKey: formData.get("idempotencyKey"),
    lines: slugs.map((slug, index) => ({ slug, quantity: quantities[index] })),
    contact: {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
    },
    address: {
      line1: formData.get("line1"),
      line2: formData.get("line2"),
      city: formData.get("city"),
      state: formData.get("state"),
      postalCode: formData.get("postalCode"),
      country: "IN",
    },
  });

  if (!result.ok) {
    return { message: result.message, fields: result.fields, reference: "", code: result.code };
  }

  const jar = await cookies();
  jar.set(
    ORDER_VIEW_COOKIE,
    packViewCookie(result.reference, result.viewToken),
    orderViewCookieOptions(process.env.NODE_ENV),
  );
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/collections/kani");
  revalidatePath("/collections/embroidered");
  revalidatePath("/collections/everyday");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  for (const slug of slugs) {
    if (typeof slug === "string" && SLUG.test(slug) && slug.length <= 80) {
      revalidatePath(`/products/${slug}`);
    }
  }

  return { message: "", fields: {}, reference: result.reference, code: "" };
}
