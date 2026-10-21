import { Suspense } from "react";
import type { Metadata } from "next";
import { Benefits } from "@/components/benefits";
import { CatalogueLoading } from "@/components/catalogue-status";
import { CollectionGrid } from "@/components/collection-grid";
import { Craftsmanship } from "@/components/craftsmanship";
import { FeaturedShawls } from "@/components/featured-shawls";
import { Hero } from "@/components/hero";
import { Newsletter } from "@/components/newsletter";
import { absoluteUrl } from "@/lib/site/sitemap-entries";

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
};

export default function Home() {
  return (
    <>
      <Hero />
      <Suspense fallback={<CatalogueLoading label="Loading the collections." />}>
        <CollectionGrid />
      </Suspense>
      <Suspense fallback={<CatalogueLoading label="Loading the featured shawls." />}>
        <FeaturedShawls />
      </Suspense>
      <Craftsmanship />
      <Benefits />
      <Newsletter />
    </>
  );
}
