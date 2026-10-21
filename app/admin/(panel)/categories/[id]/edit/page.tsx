import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { saveCategory } from "@/app/admin/category-actions";
import { getManagedCategory } from "@/lib/categories/admin";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { LOCAL_IMAGES } from "@/lib/products/images";
import { AdminAccessError } from "@/lib/products/admin-repository";

export const metadata: Metadata = { title: "Edit category" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function EditCategory({ params, searchParams }: PageProps) {
  const { id } = await params;
  const raw = await searchParams;
  let category: Awaited<ReturnType<typeof getManagedCategory>> = null;
  try {
    category = await getManagedCategory(id);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return <p className="text-base text-ink">{error.message}</p>;
    }
    throw error;
  }
  if (!category) {
    return (
      <>
        <h1 className="font-serif text-4xl text-forest">Category not found</h1>
        <Link href="/admin/categories" className="mt-6 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">Back to categories</Link>
      </>
    );
  }
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">{category.name}</h1>
      <p className="mt-4 text-sm text-muted">
        {category.activeProductCount} active {category.activeProductCount === 1 ? "shawl" : "shawls"} · created {category.createdAt.slice(0, 10) || "not recorded"}
      </p>
      <CategoryForm
        categoryId={category.id}
        action={saveCategory.bind(null, category.id)}
        values={{
          name: category.name,
          slug: category.slug,
          description: category.description,
          imageUrl: category.imageUrl,
          imageAlt: category.imageAlt,
          active: category.active,
          displayOrder: String(category.displayOrder),
          expectedUpdatedAt: category.updatedAt,
        }}
        localImages={[...LOCAL_IMAGES]}
        cloudinaryReady={cloudinaryConfigured()}
        saved={raw.saved === "1"}
      />
    </>
  );
}

export default function EditCategoryPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the category…</p>}>
      <EditCategory params={params} searchParams={searchParams} />
    </Suspense>
  );
}
