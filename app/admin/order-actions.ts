"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { updateOrderFulfilment } from "@/lib/orders/admin";
import { isPublicReference } from "@/lib/orders/reference";
import { AdminAccessError } from "@/lib/products/admin-repository";

export type FulfilmentFormState = { message: string };

export async function saveFulfilment(
  reference: string,
  _previous: FulfilmentFormState,
  formData: FormData,
): Promise<FulfilmentFormState> {
  if (!isPublicReference(reference)) {
    return { message: "That order is not in the desk." };
  }
  try {
    const result = await updateOrderFulfilment(reference, formData.get("fulfilmentStatus"));
    if (!result.ok) {
      return { message: result.message };
    }
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${reference}`);
    revalidatePath("/");
    revalidatePath("/shop");
    return { message: "Fulfilment saved." };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return { message: error.message };
    }
    throw error;
  }
}
