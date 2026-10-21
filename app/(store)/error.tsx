"use client";

import { Container } from "@/components/container";

export default function Error({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="py-24">
      <Container>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
          Catalogue
        </p>
        <h1 className="mt-4 max-w-xl font-serif text-4xl text-forest sm:text-6xl">
          This page could not be loaded.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          The catalogue did not finish loading. If this is a new setup, add MONGODB_URI to
          .env.local and run pnpm seed. Server logs keep the details, and the connection string
          is not shown here.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-8 inline-flex min-h-12 items-center justify-center bg-burgundy px-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
        >
          Try again
        </button>
      </Container>
    </div>
  );
}
