import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { saveProduct } from "@/app/admin/actions";
import { managedCategoryChoices } from "@/lib/categories/admin";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { LOCAL_IMAGES } from "@/lib/products/images";
import { paiseToRupeeInput } from "@/lib/products/validate";
import { productSaveNotice } from "@/lib/catalogue/visibility";
import { AdminAccessError, getAdminProduct } from "@/lib/products/admin-repository";

export const metadata: Metadata = { title: "Edit shawl" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valuesFromProduct(product: NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    category: product.category,
    collectionSlugs: product.collectionSlugs,
    priceRupees: paiseToRupeeInput(product.pricePaise),
    compareAtRupees: product.compareAtPricePaise === null ? "" : paiseToRupeeInput(product.compareAtPricePaise),
    sku: product.sku,
    stockQuantity: String(product.stockQuantity),
    status: product.status,
    featured: product.featured,
    images: product.images,
    material: product.material,
    dimensions: product.dimensions,
    care: product.care,
    color: product.color,
    weave: product.weave,
    embroidery: product.embroidery,
    size: product.size,
    variantGroup: product.variantGroup,
    variantLabel: product.variantLabel,
    expectedUpdatedAt: product.updatedAt,
    linkSourceId: "",
  };
}

async function EditProduct({ params, searchParams }: PageProps) {
  const { id } = await params;
  const raw = await searchParams;
  let product: Awaited<ReturnType<typeof getAdminProduct>> = null;
  try {
    product = await getAdminProduct(id);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return <p className="text-base text-ink">{error.message}</p>;
    }
    throw error;
  }
  if (!product) {
    return (
      <>
        <h1 className="font-serif text-4xl text-forest">Shawl not in the catalogue</h1>
        <Link href="/admin/products" className="mt-6 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
          Back to products
        </Link>
      </>
    );
  }
  const categories = await managedCategoryChoices();
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">{product.name}</h1>
      <p className="mt-4 text-sm text-muted">
        {product.status === "active"
          ? `Active · public address /products/${product.slug}`
          : product.status === "draft"
            ? "Draft · in the admin list, hidden from the shop"
            : "Archived · hidden from the shop"}
        {product.createdAt ? ` · created ${product.createdAt.slice(0, 10)}` : ""}
        {product.lowStock ? " · low catalogue quantity" : ""}
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        <Link href={`/admin/products/${product.id}/preview`} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
          Preview
        </Link>
        <Link href={`/admin/products/new?from=${product.id}`} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
          Add a stocked option
        </Link>
      </div>
      <ProductForm
        key={product.id}
        productId={product.id}
        action={saveProduct.bind(null, product.id)}
        values={valuesFromProduct(product)}
        categories={categories}
        localImages={[...LOCAL_IMAGES]}
        cloudinaryReady={cloudinaryConfigured()}
        notice={raw.saved === "1" ? productSaveNotice(product.status) : ""}
      />
    </>
  );
}

export default function EditProductPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the shawl…</p>}>
      <EditProduct params={params} searchParams={searchParams} />
    </Suspense>
  );
}
