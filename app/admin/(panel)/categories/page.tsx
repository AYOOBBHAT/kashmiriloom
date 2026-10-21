import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryActiveButton, CategoryDeleteButton } from "@/components/admin/category-actions-ui";
import { listManagedCategories } from "@/lib/categories/admin";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { AdminAccessError } from "@/lib/products/admin-repository";

export const metadata: Metadata = { title: "Categories" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function CategoryList({ searchParams }: PageProps) {
  const raw = await searchParams;
  const search = (first(raw.search) ?? "").trim();
  const pageText = first(raw.page) ?? "1";
  const page = /^\d{1,4}$/.test(pageText) ? Number(pageText) : 1;
  if (search.length > 80 || page < 1) {
    return <p className="mt-6 text-base text-burgundy">That search or page is not available.</p>;
  }
  let result: Awaited<ReturnType<typeof listManagedCategories>> | null = null;
  let problem = "";
  try {
    result = await listManagedCategories(search, page);
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
  return (
    <>
      <form method="get" className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="category-search" className="text-sm font-medium text-forest">Search name or slug</label>
          <input id="category-search" name="search" defaultValue={search} maxLength={80} className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink" />
        </div>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center bg-forest px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory">
          Apply
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">{result.total} {result.total === 1 ? "category" : "categories"}</p>
      {result.items.length === 0 ? (
        <p className="mt-6 text-base text-muted">No categories match. Run the seed once if the original three collections are not in the database yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-y border-gold/60 text-left">
            <thead>
              <tr className="text-[0.72rem] uppercase tracking-[0.16em] text-burgundy">
                <th className="py-3 pr-3 font-semibold">Category</th>
                <th className="py-3 pr-3 font-semibold">Slug</th>
                <th className="py-3 pr-3 font-semibold">Active shawls</th>
                <th className="py-3 pr-3 font-semibold">Status</th>
                <th className="py-3 pr-3 font-semibold">Order</th>
                <th className="py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((category) => (
                <tr key={category.id} className="border-t border-gold/60 align-top">
                  <td className="py-4 pr-3">
                    <div className="flex items-center gap-3">
                      {category.imageUrl ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-forest/5">
                          <Image src={category.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                        </div>
                      ) : null}
                      <Link href={`/admin/categories/${category.id}/edit`} className="font-serif text-2xl text-forest underline decoration-gold underline-offset-4">
                        {category.name}
                      </Link>
                    </div>
                  </td>
                  <td className="py-4 pr-3 text-sm text-ink">{category.slug}</td>
                  <td className="py-4 pr-3 text-sm text-ink">{category.activeProductCount}</td>
                  <td className="py-4 pr-3 text-sm text-ink">{category.active ? "Active" : "Inactive"}</td>
                  <td className="py-4 pr-3 text-sm text-ink">{category.displayOrder}</td>
                  <td className="py-4">
                    <div className="flex flex-col items-start">
                      <Link href={`/admin/categories/${category.id}/edit`} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
                        Edit
                      </Link>
                      <CategoryActiveButton id={category.id} active={category.active} name={category.name} />
                      {category.productCount === 0 ? <CategoryDeleteButton id={category.id} name={category.name} /> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.pageCount > 1 ? (
        <nav className="mt-6 flex gap-4" aria-label="Category pages">
          {result.page > 1 ? <Link href={`/admin/categories?page=${result.page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`} className="min-h-12 text-sm text-forest underline">Previous</Link> : null}
          {result.page < result.pageCount ? <Link href={`/admin/categories?page=${result.page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`} className="min-h-12 text-sm text-forest underline">Next</Link> : null}
        </nav>
      ) : null}
    </>
  );
}

export default function CategoriesPage({ searchParams }: PageProps) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
          <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">Categories</h1>
        </div>
        <Link href="/admin/categories/new" className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest">
          New category
        </Link>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted">Loading categories…</p>}>
        <CategoryList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
