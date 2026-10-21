import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { availabilityLabel } from "@/data/catalog";
import { sampleProductSlugs } from "@/data/sample-products";
import { formatInrFromPaise } from "@/lib/money";
import { absoluteUrl } from "@/lib/site/sitemap-entries";
import {
  getPublicProductRoute,
  listRelatedProducts,
  withCatalogue,
} from "@/lib/products/repository";
import { AddToBag } from "@/components/add-to-bag";
import { CatalogueLoading, CatalogueProblem } from "@/components/catalogue-status";
import { Container } from "@/components/container";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { JsonLd } from "@/components/json-ld";
import { productPageJsonLd } from "@/lib/site/structured-data";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return sampleProductSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await withCatalogue(() => getPublicProductRoute(slug));
  if (!result.ok || result.data.kind === "missing") {
    return { title: "Shawl" };
  }
  if (result.data.kind === "redirect") {
    return {
      title: "Shawl",
      alternates: { canonical: absoluteUrl(`/products/${result.data.slug}`) },
    };
  }
  return {
    title: result.data.product.name,
    description: `${result.data.product.summary} Price ${formatInrFromPaise(result.data.product.pricePaise)}.`,
    alternates: { canonical: absoluteUrl(`/products/${result.data.product.slug}`) },
  };
}

async function ProductDetail({ params }: ProductPageProps) {
  const { slug } = await params;
  const result = await withCatalogue(() => getPublicProductRoute(slug));
  if (!result.ok) {
    return <CatalogueProblem problem={result.problem} />;
  }
  if (result.data.kind === "redirect") {
    redirect(`/products/${result.data.slug}`);
  }
  if (result.data.kind === "missing") {
    notFound();
  }

  const product = result.data.product;
  const relatedResult = await withCatalogue(() =>
    listRelatedProducts(product.category, product.slug),
  );
  const facts = [
    product.material ? { term: "Material", detail: product.material } : null,
    product.color ? { term: "Colour", detail: product.color } : null,
    product.weave ? { term: "Weave", detail: product.weave } : null,
    product.embroidery ? { term: "Embroidery", detail: product.embroidery } : null,
    product.size ? { term: "Size", detail: product.size } : null,
    product.dimensions ? { term: "Dimensions", detail: product.dimensions } : null,
    product.care ? { term: "Care", detail: product.care } : null,
  ].filter((fact) => fact !== null);

  return (
    <>
      <JsonLd data={productPageJsonLd(product)} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/shop" className="underline decoration-gold underline-offset-4">
              Shop
            </Link>
          </li>
          <li className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              <Link href={`/collections/${product.category}`} className="underline decoration-gold underline-offset-4">
                {product.categoryName}
              </Link>
            </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <span className="text-ink">{product.name}</span>
          </li>
        </ol>
      </nav>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
            {product.categoryName}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight text-balance text-forest sm:text-6xl">
            {product.name}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{product.description}</p>
          <p className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy">
            Price
          </p>
          <p className="mt-2 font-serif text-4xl text-forest">
            {formatInrFromPaise(product.pricePaise)}
          </p>
          {product.compareAtPricePaise != null ? (
            <p className="mt-2 text-base text-muted">
              <span className="sr-only">Compare-at price </span>
              <s>{formatInrFromPaise(product.compareAtPricePaise)}</s>
            </p>
          ) : null}
          <dl className="mt-8 max-w-xl space-y-4 border-t border-gold/70 pt-6">
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
                Category
              </dt>
              <dd className="mt-1 text-base text-ink">
                <Link href={`/collections/${product.category}`} className="underline decoration-gold underline-offset-4">
                  {product.categoryName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
                Availability
              </dt>
              <dd className="mt-1 text-base text-ink">{availabilityLabel(product.available)}</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
                Catalogue quantity
              </dt>
              <dd className="mt-1 text-base text-ink">
                {product.stockQuantity}. This is the number saved for the product, not a shipping
                promise.
              </dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
                SKU
              </dt>
              <dd className="mt-1 text-base text-ink">{product.sku}</dd>
            </div>
            {facts.map((fact) => (
              <div key={fact.term}>
                <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
                  {fact.term}
                </dt>
                <dd className="mt-1 text-base leading-relaxed text-ink">{fact.detail}</dd>
              </div>
            ))}
          </dl>
          {product.variants.length > 0 ? (
            <div className="mt-8">
              <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Options</h2>
              <ul className="mt-3 flex flex-col gap-2">
                <li className="text-base text-ink">{product.variantLabel || product.name} · this shawl</li>
                {product.variants.map((variant) => (
                  <li key={variant.slug}>
                    <Link href={`/products/${variant.slug}`} className="text-forest underline decoration-gold underline-offset-4">
                      {variant.label}
                      {variant.available ? "" : " · unavailable"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <AddToBag slug={product.slug} name={product.name} available={product.available} />
        </div>
      </div>

      {relatedResult.ok && relatedResult.data.length > 0 ? (
        <section aria-labelledby="related-title" className="mt-20 border-t border-gold/60 pt-14">
          <h2 id="related-title" className="font-serif text-4xl text-forest">
            From the same collection
          </h2>
          <ul className="mt-10 grid min-w-0 list-none gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {relatedResult.data.map((item) => (
              <li key={item.slug}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {relatedResult.ok ? null : (
        <p className="mt-16 text-base text-muted">{relatedResult.problem.message}</p>
      )}
    </>
  );
}

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <div className="py-12 sm:py-20">
      <Container>
        <Suspense fallback={<CatalogueLoading label="Loading this shawl." />}>
          <ProductDetail params={params} />
        </Suspense>
      </Container>
    </div>
  );
}
