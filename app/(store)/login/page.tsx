import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Container } from "@/components/container";
import { LoginForm } from "@/components/customer-auth";
import { getCurrentCustomer } from "@/lib/customers/current";
import { safeNextPath } from "@/lib/customers/paths";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const notices: Record<string, string> = {
  reset: "Your password was updated. Sign in with the new password.",
  cancelled: "Google sign-in was cancelled.",
  failed: "Google sign-in could not be completed.",
  link: "Google was not linked. Sign in with your password, then connect Google from your account.",
};

export default function LoginPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<Container className="py-16"><p className="text-muted">Loading sign in…</p></Container>}>
      <LoginSearch searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginSearch({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const customer = await getCurrentCustomer();
  if (customer) {
    redirect(next);
  }
  const notice = notices[first(params.reset) === "1" ? "reset" : first(params.error)] ?? "";
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Account</p>
        <h1 className="mt-3 font-serif text-5xl text-forest">Sign in</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Use your email and password, or Google. You can still check out as a guest.
        </p>
        <div className="mt-8">
          <LoginForm next={next} notice={notice || undefined} />
        </div>
      </div>
    </Container>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
