import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/container";
import { ResetPasswordForm } from "@/components/customer-auth";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ResetPasswordPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<Container className="py-16"><p className="text-muted">Loading the reset form…</p></Container>}>
      <ResetSearch searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetSearch({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = first(params.token);
  const usable = /^[A-Za-z0-9_-]{43}$/.test(token);
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Account</p>
        <h1 className="mt-3 font-serif text-5xl text-forest">Choose a new password</h1>
        <div className="mt-8">
          {usable ? (
            <ResetPasswordForm token={token} />
          ) : (
            <p className="text-base leading-relaxed text-ink">This reset link is invalid or has expired.</p>
          )}
        </div>
      </div>
    </Container>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
