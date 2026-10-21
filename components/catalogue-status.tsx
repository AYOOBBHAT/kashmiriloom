import type { CatalogueProblem } from "@/lib/catalogue-error";

export function CatalogueProblem({ problem }: { problem: CatalogueProblem }) {
  return (
    <div role="alert" className="mt-10 border border-gold/70 px-6 py-10">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-burgundy">
        Catalogue unavailable
      </p>
      <h2 className="mt-3 font-serif text-3xl text-forest">The shawls could not be loaded.</h2>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{problem.message}</p>
      {problem.code === "missing-uri" ? (
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-base leading-relaxed text-ink">
          <li>Copy .env.example to .env.local.</li>
          <li>Set MONGODB_URI to the Atlas connection string.</li>
          <li>Restart the dev server.</li>
          <li>Run pnpm seed to insert the six sample shawls.</li>
        </ol>
      ) : (
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink">
          After the cluster and connection string are corrected, try this page again.
        </p>
      )}
    </div>
  );
}

export function CatalogueLoading({ label }: { label: string }) {
  return (
    <p role="status" className="py-16 text-lg text-muted">
      {label}
    </p>
  );
}
