import Link from "next/link";
import { PhotoFrame } from "@/components/photo-frame";
import { formatInrFromPaise } from "@/lib/money";
import type { ProductDto } from "@/lib/products/types";

type ProductCardProps = {
  product: ProductDto;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article id={product.slug} tabIndex={-1} className="flex h-full scroll-mt-28 flex-col outline-none">
      <Link href={`/products/${product.slug}`} className="flex h-full flex-col">
        <PhotoFrame
          src={product.image}
          alt={product.imageAlt}
          width={product.imageWidth}
          height={product.imageHeight}
          quality={60}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
        />
        <div className="mt-5 flex flex-1 flex-col">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy">
            {product.categoryName}
          </p>
          <h3 className="mt-2 font-serif text-3xl text-forest">{product.name}</h3>
          <p className="mt-2 max-w-md text-base leading-relaxed text-muted">{product.summary}</p>
          <div className="pt-3">
            <p className="font-serif text-2xl text-forest">
              <span className="sr-only">Price </span>
              {formatInrFromPaise(product.pricePaise)}
            </p>
            {product.compareAtPricePaise != null ? (
              <p className="mt-1 text-sm text-muted">
                <span className="sr-only">Compare-at price </span>
                <s>{formatInrFromPaise(product.compareAtPricePaise)}</s>
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
