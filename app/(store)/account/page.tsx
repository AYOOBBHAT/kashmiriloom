import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { signOutAction } from "@/app/(store)/auth-actions";
import { Container } from "@/components/container";
import { GoogleSignIn } from "@/components/customer-auth";
import { getCurrentCustomer } from "@/lib/customers/current";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <Suspense fallback={<Container className="py-16"><p className="text-muted">Loading your account…</p></Container>}>
      <AccountProfile />
    </Suspense>
  );
}

async function AccountProfile() {
  await connection();
  const customer = await getCurrentCustomer();
  if (!customer) {
    return null;
  }
  return (
    <Container className="py-12 sm:py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Account</p>
      <h1 className="mt-3 font-serif text-5xl text-forest">{customer.name}</h1>
      <dl className="mt-8 max-w-xl border border-gold/80 px-5 py-5">
        <div>
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Email</dt>
          <dd className="mt-2 text-lg text-forest">{customer.email}</dd>
        </div>
        <div className="mt-5">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Email status</dt>
          <dd className="mt-2 text-base text-ink">
            {customer.emailVerified ? "Confirmed by Google." : "Not confirmed. You can still sign in and check out."}
          </dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Link href="/account/orders" className="text-forest underline decoration-gold underline-offset-4">
          Order history
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="text-sm font-semibold uppercase tracking-[0.16em] text-burgundy">
            Sign out
          </button>
        </form>
      </div>
      {customer.googleConnected ? (
        <p className="mt-8 text-sm text-muted">Google is connected to this account.</p>
      ) : (
        <div className="mt-8 max-w-sm">
          <GoogleSignIn next="/account" link />
        </div>
      )}
    </Container>
  );
}
