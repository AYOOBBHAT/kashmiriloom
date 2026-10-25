import Image from "next/image";
import Link from "next/link";
import { formatInrFromPaise } from "@/lib/money";
import type { ProductDto } from "@/lib/products/types";

type ProductCardProps = {
  product: ProductDto;
  featured?: boolean;
};

export function ProductCard({ product, featured = false }: ProductCardProps) {
  return (
    <article id={product.slug} tabIndex={-1} className="scroll-mt-28 outline-none">
      <Link href={`/products/${product.slug}`} className="group block">
        <div
          className={`relative overflow-hidden bg-forest/5 ${
            featured ? "aspect-[4/5] sm:aspect-[16/10]" : "aspect-square"
          }`}
        >
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            quality={60}
            sizes={
              featured
                ? "(min-width: 640px) 66vw, 100vw"
                : "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            }
            className="object-cover motion-safe:transition motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]"
          />
        </div>
        <p className="mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy">
          {product.categoryName}
        </p>
        <h3 className="mt-2 font-serif text-3xl text-forest">{product.name}</h3>
        <p className="mt-2 max-w-md text-base leading-relaxed text-muted">{product.summary}</p>
        <p className="mt-3 font-serif text-2xl text-forest">
          <span className="sr-only">Price </span>
          {formatInrFromPaise(product.pricePaise)}
        </p>
        {product.compareAtPricePaise != null ? (
          <p className="mt-1 text-sm text-muted">
            <span className="sr-only">Compare-at price </span>
            <s>{formatInrFromPaise(product.compareAtPricePaise)}</s>
          </p>
        ) : null}
      </Link>
    </article>
  );
}
