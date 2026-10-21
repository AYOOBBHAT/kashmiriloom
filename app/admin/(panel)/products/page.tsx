import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeactivateButton } from "@/components/admin/deactivate-button";
import { managedCategoryChoices } from "@/lib/categories/admin";
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

function Filters({ query, categories }: { query: AdminListQuery; categories: { slug: string; name: string }[] }) {
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
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
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
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
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
  const categories = await managedCategoryChoices();
  return (
      <>
        <Filters query={query} categories={categories} />
        <p className="mt-6 text-sm text-muted">
          {result.total} {result.total === 1 ? "shawl" : "shawls"}
          {result.total > ADMIN_PAGE_SIZE ? ` · page ${result.page} of ${result.pageCount}` : ""}
        </p>
        {result.items.length === 0 ? (
          <p className="mt-6 text-base leading-relaxed text-muted">No shawls match these filters.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] border-y border-gold/60 text-left">
              <thead>
                <tr className="text-[0.72rem] uppercase tracking-[0.16em] text-burgundy">
                  <th className="py-3 pr-3 font-semibold">Shawl</th>
                  <th className="py-3 pr-3 font-semibold">SKU</th>
                  <th className="py-3 pr-3 font-semibold">Category</th>
                  <th className="py-3 pr-3 font-semibold">Price</th>
                  <th className="py-3 pr-3 font-semibold">Stock</th>
                  <th className="py-3 pr-3 font-semibold">Status</th>
                  <th className="py-3 pr-3 font-semibold">Updated</th>
                  <th className="py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => (
                  <tr key={product.id} className="border-t border-gold/60 align-top">
                    <td className="py-4 pr-3">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-forest/5">
                            <Image src={product.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                          </div>
                        ) : null}
                        <Link href={`/admin/products/${product.id}/edit`} className="font-serif text-2xl text-forest underline decoration-gold underline-offset-4">
                          {product.name}
                        </Link>
                      </div>
                    </td>
                    <td className="py-4 pr-3 text-sm text-ink">{product.sku}</td>
                    <td className="py-4 pr-3 text-sm text-ink">{product.categoryName}</td>
                    <td className="py-4 pr-3 text-sm text-ink">{formatInrFromPaise(product.pricePaise)}</td>
                    <td className="py-4 pr-3 text-sm text-ink">
                      {product.stockQuantity}
                      {product.lowStock ? " · low" : ""}
                    </td>
                    <td className="py-4 pr-3 text-sm capitalize text-ink">{product.status}</td>
                    <td className="py-4 pr-3 text-sm text-ink">{product.updatedAt.slice(0, 10) || "—"}</td>
                    <td className="py-4">
                      <div className="flex flex-col items-start">
                        <Link href={`/admin/products/${product.id}/edit`} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
                          Edit
                        </Link>
                        {product.status !== "archived" ? <DeactivateButton id={product.id} name={product.name} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
