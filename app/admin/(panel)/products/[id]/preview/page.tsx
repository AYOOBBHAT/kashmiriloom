import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { formatInrFromPaise } from "@/lib/money";
import { AdminAccessError, getAdminProduct } from "@/lib/products/admin-repository";

export const metadata: Metadata = { title: "Preview shawl" };

type PageProps = { params: Promise<{ id: string }> };

async function Preview({ params }: PageProps) {
  const { id } = await params;
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
    return <h1 className="font-serif text-4xl text-forest">Shawl not in the catalogue</h1>;
  }
  const primary = product.images.find((image) => image.primary) ?? product.images[0];
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Preview</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">{product.name}</h1>
      <p className="mt-4 max-w-2xl text-base text-muted">
        This preview is only for a signed-in administrator. The shop shows this shawl when its status is active.
        Current status: {product.status}.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="grid gap-4">
          {primary ? (
            <div className="relative aspect-square overflow-hidden bg-forest/5">
              <Image src={primary.url} alt={primary.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            </div>
          ) : null}
          <ul className="grid grid-cols-3 gap-3">
            {product.images.map((image) => (
              <li key={image.url} className="relative aspect-square overflow-hidden bg-forest/5">
                <Image src={image.url} alt={image.alt} fill sizes="120px" className="object-cover" />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm text-burgundy">{product.categoryName}</p>
          <p className="mt-4 text-lg leading-relaxed text-ink">{product.shortDescription || product.description}</p>
          <p className="mt-6 font-serif text-4xl text-forest">{formatInrFromPaise(product.pricePaise)}</p>
          <dl className="mt-6 space-y-3 text-sm text-ink">
            <div><dt className="text-burgundy">SKU</dt><dd>{product.sku}</dd></div>
            <div><dt className="text-burgundy">Catalogue quantity</dt><dd>{product.stockQuantity}{product.lowStock ? " · low" : ""}</dd></div>
            {product.variantLabel ? <div><dt className="text-burgundy">Option</dt><dd>{product.variantLabel}</dd></div> : null}
            {product.color ? <div><dt className="text-burgundy">Colour</dt><dd>{product.color}</dd></div> : null}
            {product.size ? <div><dt className="text-burgundy">Size</dt><dd>{product.size}</dd></div> : null}
          </dl>
          <Link href={`/admin/products/${product.id}/edit`} className="mt-8 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
            Back to edit
          </Link>
        </div>
      </div>
    </>
  );
}

export default function PreviewPage({ params }: PageProps) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the preview…</p>}>
      <Preview params={params} />
    </Suspense>
  );
}
