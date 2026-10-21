import { listFeaturedProducts, withCatalogue } from "@/lib/products/repository";
import { CatalogueProblem } from "@/components/catalogue-status";
import { Container } from "@/components/container";
import { ProductCard } from "@/components/product-card";
import { SectionHeading } from "@/components/section-heading";

export async function FeaturedShawls() {
  const result = await withCatalogue(() => listFeaturedProducts());

  return (
    <section aria-labelledby="shop-title" className="border-t border-gold/50 py-20 sm:py-28">
      <Container>
        <SectionHeading id="shop" eyebrow="The edit" title="Shawls for the season">
          <p>Featured pieces from the catalogue. Prices are shown in INR.</p>
        </SectionHeading>
        {!result.ok ? (
          <CatalogueProblem problem={result.problem} />
        ) : result.data.length === 0 ? (
          <p className="mt-12 text-lg text-muted">No shawls are marked for this edit.</p>
        ) : (
          <ul className="mt-12 grid min-w-0 list-none gap-x-6 gap-y-14 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-x-8">
            {result.data.map((product, index) => (
              <li key={product.slug} className={index === 0 ? "sm:col-span-2" : undefined}>
                <ProductCard product={product} featured={index === 0} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
