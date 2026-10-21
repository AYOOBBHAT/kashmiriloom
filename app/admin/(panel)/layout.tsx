import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError } from "@/lib/catalogue-error";

async function Authorized({ children }: { children: ReactNode }) {
  let email = "";
  let problem = "";
  try {
    const admin = await getCurrentAdmin();
    email = admin?.email ?? "";
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      problem = error.message;
    } else {
      throw error;
    }
  }
  if (problem) {
    return (
      <AdminShell email="">
        <p className="max-w-xl border border-gold bg-ivory px-4 py-4 text-base leading-relaxed text-ink" role="alert">
          {problem}
        </p>
      </AdminShell>
    );
  }
  if (!email) {
    redirect("/admin/login");
  }
  return <AdminShell email={email}>{children}</AdminShell>;
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <AdminShell email="">
          <p className="text-muted">Loading the dashboard…</p>
        </AdminShell>
      }
    >
      <Authorized>{children}</Authorized>
    </Suspense>
  );
}
