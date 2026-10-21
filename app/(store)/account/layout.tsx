import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/container";
import { getCurrentCustomer } from "@/lib/customers/current";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Container className="py-16">
          <p className="text-muted">Loading your account…</p>
        </Container>
      }
    >
      <AccountGate>{children}</AccountGate>
    </Suspense>
  );
}

async function AccountGate({ children }: { children: ReactNode }) {
  await connection();
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/login?next=/account");
  }
  return children;
}
