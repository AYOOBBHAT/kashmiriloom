import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { CUSTOMER_COOKIE_NAME } from "@/lib/customers/cookie";
import { customerFromSessionToken, type CurrentCustomer } from "@/lib/customers/sessions";

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  await connection();
  const jar = await cookies();
  return customerFromSessionToken(jar.get(CUSTOMER_COOKIE_NAME)?.value ?? "");
}
