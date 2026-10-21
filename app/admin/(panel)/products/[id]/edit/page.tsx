import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { saveProduct } from "@/app/admin/actions";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { LOCAL_IMAGES } from "@/lib/products/images";
import { paiseToRupeeInput } from "@/lib/products/validate";
import { AdminAccessError, getAdminProduct } from "@/lib/products/admin-repository";

export const metadata: Metadata = {
  title: "Edit shawl",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valuesFromProduct(product: NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    priceRupees: paiseToRupeeInput(product.pricePaise),
    compareAtRupees:
      product.compareAtPricePaise === null ? "" : paiseToRupeeInput(product.compareAtPricePaise),
    sku: product.sku,
    stockQuantity: String(product.stockQuantity),
    active: product.active,
    featured: product.featured,
    images: product.images,
    material: product.material,
    dimensions: product.dimensions,
    care: product.care,
  };
}

async function EditProduct({ params, searchParams }: PageProps) {
  const { id } = await params;
  const raw = await searchParams;
  const saved = raw.saved === "1";

  let product: Awaited<ReturnType<typeof getAdminProduct>> = null;
  let problem = "";
  try {
    product = await getAdminProduct(id);
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
  if (problem) {
    return <p className="text-base leading-relaxed text-ink">{problem}</p>;
  }
  if (!product) {
    return (
      <>
        <h1 className="font-serif text-4xl text-forest">Shawl not in the catalogue</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          That record is missing, or the address is not a catalogue id.
        </p>
        <Link href="/admin/products" className="mt-6 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
          Back to products
        </Link>
      </>
    );
  }

  return (
      <>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Catalogue</p>
        <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">{product.name}</h1>
        <p className="mt-4 text-sm text-muted">
          Public address: /products/{product.slug}
          {product.active ? "" : " · inactive, so the shop does not list it"}
        </p>
        <ProductForm
          key={product.id}
          productId={product.id}
          action={saveProduct.bind(null, product.id)}
          values={valuesFromProduct(product)}
          localImages={[...LOCAL_IMAGES]}
          cloudinaryReady={cloudinaryConfigured()}
          saved={saved}
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
