import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCollectionBySlug, collections, type CollectionId } from "@/data/catalog";
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
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    return { title: "Collection not found" };
  }
  return {
    title: collection.name,
    description: `${collection.description} Prices are shown in INR.`,
  };
}

async function CollectionProducts({ category }: { category: CollectionId }) {
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

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    notFound();
  }

  return (
    <div className="py-16 sm:py-24">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/3] overflow-hidden bg-forest/5">
            <Image
              src={collection.image}
              alt={collection.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
          <SectionHeading
            id={`${collection.slug}-intro`}
            level="h1"
            eyebrow="Collection"
            title={collection.name}
          >
            <p>{collection.description} Prices on this page are shown in INR.</p>
          </SectionHeading>
        </div>
        <Suspense fallback={<CatalogueLoading label="Loading this collection." />}>
          <CollectionProducts category={collection.id} />
        </Suspense>
      </Container>
    </div>
  );
}
