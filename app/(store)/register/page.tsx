import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/container";
import { RegisterForm } from "@/components/customer-auth";
import { getCurrentCustomer } from "@/lib/customers/current";
import { safeNextPath } from "@/lib/customers/paths";

export const metadata: Metadata = {
  title: "Register",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function RegisterPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<Container className="py-16"><p className="text-muted">Loading registration…</p></Container>}>
      <RegisterSearch searchParams={searchParams} />
    </Suspense>
  );
}

async function RegisterSearch({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  if (await getCurrentCustomer()) {
    redirect(next);
  }
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Account</p>
        <h1 className="mt-3 font-serif text-5xl text-forest">Create an account</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Registration does not send a verification email. You can sign in immediately, or continue as a guest at checkout.
        </p>
        <div className="mt-8">
          <RegisterForm next={next} />
        </div>
      </div>
    </Container>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
