import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { saveProduct } from "@/app/admin/actions";
import { managedCategoryChoices } from "@/lib/categories/admin";
import { getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { getAdminProduct } from "@/lib/products/admin-repository";
import { LOCAL_IMAGES } from "@/lib/products/images";
import { paiseToRupeeInput } from "@/lib/products/validate";

export const metadata: Metadata = { title: "New shawl" };

const blank: ProductFormValues = {
  name: "",
  slug: "",
  description: "",
  shortDescription: "",
  category: "kani",
  collectionSlugs: [],
  priceRupees: "",
  compareAtRupees: "",
  sku: "",
  stockQuantity: "0",
  status: "draft",
  featured: false,
  images: [],
  material: "",
  dimensions: "",
  care: "",
  color: "",
  weave: "",
  embroidery: "",
  size: "",
  variantGroup: "",
  variantLabel: "",
  expectedUpdatedAt: "",
  linkSourceId: "",
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function NewProduct({ searchParams }: PageProps) {
  const raw = await searchParams;
  const from = typeof raw.from === "string" ? raw.from : "";
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
  const categories = await managedCategoryChoices();
  let values = { ...blank, category: categories[0]?.slug ?? "kani" };
  if (from) {
    const source = await getAdminProduct(from);
    if (source) {
      values = {
        ...values,
        name: source.name,
        description: source.description,
        shortDescription: source.shortDescription,
        category: source.category,
        collectionSlugs: source.collectionSlugs,
        priceRupees: paiseToRupeeInput(source.pricePaise),
        compareAtRupees: source.compareAtPricePaise === null ? "" : paiseToRupeeInput(source.compareAtPricePaise),
        images: source.images,
        material: source.material,
        dimensions: source.dimensions,
        care: source.care,
        color: source.color,
        weave: source.weave,
        embroidery: source.embroidery,
        size: "",
        variantGroup: source.variantGroup || source.slug,
        variantLabel: "",
        linkSourceId: source.id,
        sku: "",
        slug: "",
        status: "draft",
      };
    }
  }
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">New shawl</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Each shawl keeps its own SKU, price, and catalogue quantity. A draft stays off the shop until you set it active. Prices are stored as whole paise.
      </p>
      <ProductForm
        productId=""
        action={saveProduct.bind(null, "")}
        values={values}
        categories={categories}
        localImages={[...LOCAL_IMAGES]}
        cloudinaryReady={cloudinaryConfigured()}
        saved={false}
      />
    </>
  );
}

export default function NewProductPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the form…</p>}>
      <NewProduct searchParams={searchParams} />
    </Suspense>
  );
}
