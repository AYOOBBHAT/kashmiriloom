import { Suspense } from "react";
import type { Metadata } from "next";
import { Container } from "@/components/container";
import { CatalogueLoading } from "@/components/catalogue-status";
import { SectionHeading } from "@/components/section-heading";
import { ShopCatalog } from "@/components/shop-catalog";
import { searchProducts, withCatalogue } from "@/lib/products/repository";
import { emptyShopQuery, parseShopQuery } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop shawls",
  description:
    "Browse the KashmiriLoom catalogue of Kani, embroidered, and everyday shawls. Prices are shown in INR.",
};

type ShopPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function ShopResults({ searchParams }: ShopPageProps) {
  const raw = await searchParams;
  const parsed = parseShopQuery({
    search: first(raw.search),
    category: first(raw.category),
    sort: first(raw.sort),
  });

  if (!parsed.ok) {
    return (
      <ShopCatalog
        products={[]}
        query={emptyShopQuery}
        problem={null}
        invalidMessage={parsed.message}
      />
    );
  }

  const result = await withCatalogue(() => searchProducts(parsed.query));
  if (!result.ok) {
    return (
      <ShopCatalog
        products={[]}
        query={parsed.query}
        problem={result.problem}
        invalidMessage={null}
      />
    );
  }

  return (
    <ShopCatalog
      products={result.data}
      query={parsed.query}
      problem={null}
      invalidMessage={null}
    />
  );
}

export default function ShopPage({ searchParams }: ShopPageProps) {
  return (
    <div className="py-16 sm:py-24">
      <Container>
        <SectionHeading id="browse" level="h1" eyebrow="The edit" title="Shop shawls">
          <p>
            Shawls from the catalogue, with prices in INR. Search by name or description, then
            filter by weave.
          </p>
        </SectionHeading>
        <Suspense fallback={<CatalogueLoading label="Loading the catalogue." />}>
          <ShopResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </div>
  );
}
