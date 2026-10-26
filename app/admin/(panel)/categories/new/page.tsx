import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { saveCategory } from "@/app/admin/category-actions";
import { getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { LOCAL_IMAGES } from "@/lib/products/images";

export const metadata: Metadata = { title: "New category" };

async function NewCategory() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      redirect("/admin/login");
    }
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      return <p className="text-base text-ink">{error.message}</p>;
    }
    throw error;
  }
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">New category</h1>
      <CategoryForm
        categoryId=""
        action={saveCategory.bind(null, "")}
        values={{ name: "", slug: "", description: "", imageUrl: "", imageAlt: "", active: true, displayOrder: "0", expectedUpdatedAt: "" }}
        localImages={[...LOCAL_IMAGES]}
        cloudinaryReady={cloudinaryConfigured()}
        notice=""
      />
    </>
  );
}

export default function NewCategoryPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading the form…</p>}>
      <NewCategory />
    </Suspense>
  );
}
