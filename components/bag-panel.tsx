"use client";

import Image from "next/image";
import Link from "next/link";
import { formatInrFromPaise } from "@/lib/money";
import { MAX_BAG_QUANTITY } from "@/lib/bag";
import { useBag } from "@/components/bag-provider";

export function BagPanel({ onNavigate }: { onNavigate: () => void }) {
  const { lines, subtotalPaise, catalogueStatus, catalogueMessage, productFor, setQuantity, remove } =
    useBag();

  if (catalogueStatus === "loading") {
    return (
      <p role="status" className="text-base leading-relaxed text-muted">
        Loading catalogue prices for this bag.
      </p>
    );
  }

  if (catalogueStatus === "unavailable") {
    return (
      <div role="alert">
        <p className="text-lg text-ink">Catalogue prices are unavailable.</p>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {catalogueMessage} Saved items stay on this device. Nothing has been ordered.
        </p>
        {lines.length > 0 ? (
          <ul className="mt-6 divide-y divide-gold/70">
            {lines.map((line) => (
              <li key={line.slug} className="flex items-center justify-between gap-4 py-4">
                <p className="text-base text-ink">
                  Saved shawl
                  <span className="sr-only">, quantity {line.quantity}</span>
                </p>
                <button
                  type="button"
                  onClick={() => remove(line.slug)}
                  className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-burgundy"
                >
                  Remove
                  <span className="sr-only"> saved shawl, quantity {line.quantity}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {lines.length > 0 ? (
          <Link
            href="/checkout"
            onClick={onNavigate}
            className="mt-6 inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
          >
            Checkout
          </Link>
        ) : null}
      </div>
    );
  }

  const items = lines.flatMap((line) => {
    const product = productFor(line.slug);
    return product ? [{ product, quantity: line.quantity }] : [];
  });

  if (items.length === 0) {
    return (
      <div>
        <p className="text-lg text-ink">Your bag is empty.</p>
        <p className="mt-3 text-base leading-relaxed text-muted">Nothing is saved on this device.</p>
        <Link
          href="/shop"
          onClick={onNavigate}
          className="mt-8 inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
        >
          Browse shawls
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">
        Saved on this device. The amount is confirmed from the catalogue when you place the order.
        Payment is not taken at checkout.
      </p>
      <ul className="mt-4 divide-y divide-gold/70">
        {items.map(({ product, quantity }) => (
          <li key={product.slug} className="flex gap-4 py-4">
            <Link
              href={`/products/${product.slug}`}
              onClick={onNavigate}
              className="relative h-20 w-16 shrink-0 overflow-hidden bg-forest/5"
            >
              <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />
              <span className="sr-only">View {product.name}</span>
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/products/${product.slug}`}
                onClick={onNavigate}
                className="font-serif text-2xl leading-tight text-forest"
              >
                {product.name}
              </Link>
              <p className="mt-1 text-sm text-muted">
                <span className="sr-only">Sample price </span>
                {formatInrFromPaise(product.pricePaise)} each
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center border border-gold/80">
                  <button
                    type="button"
                    onClick={() => setQuantity(product.slug, quantity - 1)}
                    disabled={quantity <= 1}
                    className="inline-flex h-11 w-11 items-center justify-center text-forest disabled:text-muted"
                    aria-label={`Decrease quantity of ${product.name}`}
                  >
                    −
                  </button>
                  <label className="sr-only" htmlFor={`bag-qty-${product.slug}`}>
                    Quantity of {product.name}
                  </label>
                  <input
                    id={`bag-qty-${product.slug}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_BAG_QUANTITY}
                    value={quantity}
                    onChange={(event) => {
                      if (event.target.value === "") {
                        return;
                      }
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) {
                        return;
                      }
                      setQuantity(product.slug, next);
                    }}
                    className="h-11 w-12 border-x border-gold/80 bg-transparent text-center text-base text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(product.slug, quantity + 1)}
                    disabled={quantity >= MAX_BAG_QUANTITY}
                    className="inline-flex h-11 w-11 items-center justify-center text-forest disabled:text-muted"
                    aria-label={`Increase quantity of ${product.name}`}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(product.slug)}
                  className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-burgundy"
                >
                  Remove
                  <span className="sr-only"> {product.name}</span>
                </button>
              </div>
              <p className="mt-2 text-sm text-ink">
                <span className="sr-only">Line total </span>
                {formatInrFromPaise(product.pricePaise * quantity)}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-baseline justify-between gap-4 border-t border-gold/70 pt-4">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
          Subtotal
        </span>
        <span className="font-serif text-3xl text-forest">
          <span className="sr-only">Sample subtotal </span>
          {subtotalPaise === null ? "—" : formatInrFromPaise(subtotalPaise)}
        </span>
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/checkout"
          onClick={onNavigate}
          className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
        >
          Checkout
        </Link>
        <Link
          href="/shop"
          onClick={onNavigate}
          className="inline-flex min-h-12 items-center justify-center border border-forest px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-forest"
        >
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
