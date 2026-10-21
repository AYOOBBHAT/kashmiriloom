import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError } from "@/lib/catalogue-error";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

async function LoginGate() {
  let notice: string | undefined;
  let signedIn = false;
  try {
    const admin = await getCurrentAdmin();
    signedIn = Boolean(admin);
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      notice = error.message;
    } else {
      throw error;
    }
  }
  if (signedIn) {
    redirect("/admin");
  }

  return (
    <main id="main" className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
        KashmiriLoom
      </p>
      <h1 className="mt-3 font-serif text-4xl text-forest">Catalogue desk</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Sign in to manage shawls. There is no public registration. The first account is created with{" "}
        <span className="text-ink">pnpm admin:bootstrap</span> from the server environment.
      </p>
      <LoginForm notice={notice} />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="mx-auto max-w-md px-5 py-16 text-muted">
          Loading sign-in…
        </main>
      }
    >
      <LoginGate />
    </Suspense>
  );
}
