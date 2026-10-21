import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { saveProduct } from "@/app/admin/actions";
import { getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { LOCAL_IMAGES } from "@/lib/products/images";

export const metadata: Metadata = {
  title: "New shawl",
};

const blank: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  category: "kani",
  priceRupees: "",
  compareAtRupees: "",
  sku: "",
  stockQuantity: "0",
  active: false,
  featured: false,
  images: [],
  material: "",
  dimensions: "",
  care: "",
};

async function NewProduct() {
  let signedIn = false;
  let problem = "";
  try {
    const admin = await getCurrentAdmin();
    signedIn = Boolean(admin);
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      problem = error.message;
    } else {
      throw error;
    }
  }
  if (problem) {
    return <p className="text-base leading-relaxed text-ink">{problem}</p>;
  }
  if (!signedIn) {
    redirect("/admin/login");
  }

  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">New shawl</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        A new shawl stays off the shop until you mark it active. Prices are stored as whole paise.
      </p>
      <ProductForm
        productId=""
        action={saveProduct.bind(null, "")}
        values={blank}
        localImages={[...LOCAL_IMAGES]}
        cloudinaryReady={cloudinaryConfigured()}
        saved={false}
      />
    </>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading the form…</p>}>
      <NewProduct />
    </Suspense>
  );
}
