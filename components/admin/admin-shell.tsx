import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/admin/actions";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/", label: "View shop" },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-ivory">
      <header className="border-b border-gold/80 bg-ivory">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-serif text-3xl leading-none text-forest">KashmiriLoom</p>
            <p className="mt-2 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
              Catalogue desk
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Dashboard">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4"
              >
                {link.label}
              </Link>
            ))}
            {email ? (
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4"
                >
                  Sign out
                </button>
              </form>
            ) : null}
          </nav>
        </div>
        {email ? (
          <p className="mx-auto max-w-6xl px-5 pb-4 text-sm text-muted">Signed in as {email}</p>
        ) : null}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10 outline-none">
        {children}
      </main>
    </div>
  );
}
