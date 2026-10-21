import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeactivateButton } from "@/components/admin/deactivate-button";
import { collectionLabels, type CollectionId } from "@/data/catalog";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { formatInrFromPaise } from "@/lib/money";
import {
  ADMIN_PAGE_SIZE,
  adminListHref,
  parseAdminListQuery,
  type AdminListQuery,
} from "@/lib/products/admin-query";
import { AdminAccessError, listAdminProducts } from "@/lib/products/admin-repository";

export const metadata: Metadata = {
  title: "Products",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function Filters({ query }: { query: AdminListQuery }) {
  return (
    <form method="get" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <label htmlFor="product-search" className="text-sm font-medium text-forest">
          Search name, slug, or SKU
        </label>
        <input
          id="product-search"
          name="search"
          defaultValue={query.search}
          maxLength={80}
          className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
        />
      </div>
      <div>
        <label htmlFor="product-category" className="text-sm font-medium text-forest">
          Category
        </label>
        <select
          id="product-category"
          name="category"
          defaultValue={query.category}
          className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
        >
          <option value="all">All categories</option>
          {(Object.keys(collectionLabels) as CollectionId[]).map((category) => (
            <option key={category} value={category}>
              {collectionLabels[category]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="product-status" className="text-sm font-medium text-forest">
          Status
        </label>
        <select
          id="product-status"
          name="status"
          defaultValue={query.status}
          className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
        >
          <option value="all">Active and inactive</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center bg-forest px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-burgundy"
        >
          Apply
        </button>
      </div>
    </form>
  );
}

async function ProductList({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = parseAdminListQuery({
    search: first(raw.search),
    category: first(raw.category),
    status: first(raw.status),
    page: first(raw.page),
  });
  if (!parsed.ok) {
    return <p className="mt-6 text-base text-burgundy">{parsed.message}</p>;
  }

  let result: Awaited<ReturnType<typeof listAdminProducts>> | null = null;
  let problem = "";
  try {
    result = await listAdminProducts(parsed.query);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      problem = error.message;
    } else {
      throw error;
    }
  }
  if (!result) {
    return <p className="mt-6 text-base leading-relaxed text-ink">{problem}</p>;
  }
  const query = { ...parsed.query, page: result.page };
  return (
      <>
        <Filters query={query} />
        <p className="mt-6 text-sm text-muted">
          {result.total} {result.total === 1 ? "shawl" : "shawls"}
          {result.total > ADMIN_PAGE_SIZE ? ` · page ${result.page} of ${result.pageCount}` : ""}
        </p>
        {result.items.length === 0 ? (
          <p className="mt-6 text-base leading-relaxed text-muted">No shawls match these filters.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gold/60 border-y border-gold/60">
            {result.items.map((product) => (
              <li key={product.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="font-serif text-2xl text-forest underline decoration-gold underline-offset-4"
                  >
                    {product.name}
                  </Link>
                  <p className="mt-2 text-sm text-muted">
                    {product.slug} · {product.sku} · {collectionLabels[product.category]}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {formatInrFromPaise(product.pricePaise)} · catalogue quantity {product.stockQuantity} ·{" "}
                    {product.active ? "Active" : "Inactive"}
                    {product.featured ? " · Featured" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4"
                  >
                    Edit
                  </Link>
                  {product.active ? <DeactivateButton id={product.id} name={product.name} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {result.pageCount > 1 ? (
          <nav className="mt-6 flex flex-wrap items-center gap-4" aria-label="Pages">
            {result.page > 1 ? (
              <Link href={adminListHref({ ...query, page: result.page - 1 })} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
                Previous
              </Link>
            ) : null}
            <span className="text-sm text-muted">
              Page {result.page} of {result.pageCount}
            </span>
            {result.page < result.pageCount ? (
              <Link href={adminListHref({ ...query, page: result.page + 1 })} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </>
  );
}

export default function ProductsPage({ searchParams }: PageProps) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
          <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">Products</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
        >
          New shawl
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading products…</p>}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
