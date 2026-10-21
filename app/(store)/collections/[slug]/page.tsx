import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { collections } from "@/data/catalog";
import { resolveCategoryRoute, type PublicCategory } from "@/lib/categories/public";
import { listProductsByCategory, withCatalogue } from "@/lib/products/repository";
import { CatalogueLoading, CatalogueProblem } from "@/components/catalogue-status";
import { Container } from "@/components/container";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await withCatalogue(() => resolveCategoryRoute(slug));
  const category = result.ok && (result.data.kind === "active" || result.data.kind === "fallback") ? result.data.category : null;
  if (!category) {
    return { title: "Collection" };
  }
  return {
    title: category.name,
    description: `${category.description} Prices are shown in INR.`,
  };
}

async function CollectionProducts({ category }: { category: string }) {
  const result = await withCatalogue(() => listProductsByCategory(category));
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

function CollectionBody({ category }: { category: PublicCategory }) {
  return (
    <div className="py-16 sm:py-24">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
            <Image src={category.image} alt={category.imageAlt} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
          <SectionHeading id={`${category.slug}-intro`} level="h1" eyebrow="Collection" title={category.name}>
            <p>{category.description} Prices on this page are shown in INR.</p>
          </SectionHeading>
        </div>
        <Suspense fallback={<CatalogueLoading label="Loading this collection." />}>
          <CollectionProducts category={category.slug} />
        </Suspense>
      </Container>
    </div>
  );
}

async function CollectionRoute({ params }: CollectionPageProps) {
  const { slug } = await params;
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
  return <CollectionBody category={result.data.category} />;
}

export default function CollectionPage({ params }: CollectionPageProps) {
  return (
    <Suspense fallback={<CatalogueLoading label="Loading this collection." />}>
      <CollectionRoute params={params} />
    </Suspense>
  );
}
