import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveCategoryRoute, type PublicCategory } from "@/lib/categories/public";
import { listProductsByCategory, withCatalogue, type CatalogueResult } from "@/lib/products/repository";
import type { ProductDto } from "@/lib/products/types";
import { CatalogueImage } from "@/components/catalogue-image";
import { CatalogueLoading, CatalogueProblem } from "@/components/catalogue-status";
import { Container } from "@/components/container";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";
import { absoluteUrl } from "@/lib/site/sitemap-entries";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await withCatalogue(() => resolveCategoryRoute(slug));
  if (!result.ok || result.data.kind === "missing") {
    return { title: "Collection" };
  }
  if (result.data.kind === "redirect") {
    return {
      title: "Collection",
      alternates: { canonical: absoluteUrl(`/collections/${result.data.slug}`) },
    };
  }
  const category = result.data.category;
  return {
    title: category.name,
    description: `${category.description} Prices are shown in INR.`,
    alternates: { canonical: absoluteUrl(`/collections/${category.slug}`) },
  };
}

async function CollectionProducts({ products }: { products: Promise<CatalogueResult<ProductDto[]>> }) {
  const result = await products;
  if (!result.ok) {
    return <CatalogueProblem problem={result.problem} />;
  }
  if (result.data.length === 0) {
    return <p className="mt-16 text-lg text-muted">No shawls are listed in this collection.</p>;
  }
  return (
    <ul className="mt-16 grid min-w-0 list-none gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
      {result.data.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

function CollectionBody({
  category,
  products,
}: {
  category: PublicCategory;
  products: Promise<CatalogueResult<ProductDto[]>>;
}) {
  return (
    <div className="py-16 sm:py-24">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
            <CatalogueImage src={category.image} alt={category.imageAlt} fill preload quality={60} sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
          <SectionHeading id={`${category.slug}-intro`} level="h1" eyebrow="Collection" title={category.name}>
            <p>{category.description} Prices on this page are shown in INR.</p>
          </SectionHeading>
        </div>
        <Suspense fallback={<CatalogueLoading label="Loading this collection." />}>
          <CollectionProducts products={products} />
        </Suspense>
      </Container>
    </div>
  );
}

async function CollectionRoute({ params }: CollectionPageProps) {
  const { slug } = await params;
  const products = withCatalogue(() => listProductsByCategory(slug));
  const result = await withCatalogue(() => resolveCategoryRoute(slug));
  if (!result.ok) {
    return (
      <div className="py-16">
        <Container>
          <CatalogueProblem problem={result.problem} />
        </Container>
      </div>
    );
  }
  if (result.data.kind === "redirect") {
    redirect(`/collections/${result.data.slug}`);
  }
  if (result.data.kind === "missing") {
    notFound();
  }
  return <CollectionBody category={result.data.category} products={products} />;
}

export default function CollectionPage({ params }: CollectionPageProps) {
  return (
    <Suspense fallback={<CatalogueLoading label="Loading this collection." />}>
      <CollectionRoute params={params} />
    </Suspense>
  );
}
