"use client";

export default function AdminError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
        Catalogue desk
      </p>
      <h1 className="mt-4 font-serif text-4xl text-forest">This page could not be loaded.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        The dashboard did not finish loading. Server logs keep the details. Passwords, session
        secrets, and connection strings are not shown here.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 inline-flex min-h-12 items-center justify-center bg-burgundy px-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
      >
        Try again
      </button>
    </main>
  );
}
