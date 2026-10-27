"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductImage } from "@/lib/products/types";

type ProductGalleryProps = {
  images: ProductImage[];
  name: string;
};

export function ProductGallery({ images, name }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());
  const safeIndex = images[active] ? active : 0;
  const current = images[safeIndex];

  function reveal(index: number) {
    setRevealed((shown) => {
      if (shown.has(index)) {
        return shown;
      }
      const next = new Set(shown);
      next.add(index);
      return next;
    });
  }

  if (!current) {
    return null;
  }

  return (
    <div>
      <div className="relative aspect-square overflow-hidden bg-forest/5">
        <Image
          src={current.src}
          alt={current.alt}
          fill
          preload={safeIndex === 0}
          loading={safeIndex === 0 ? undefined : "eager"}
          quality={60}
          sizes="(min-width: 1024px) 48vw, 100vw"
          className="object-cover"
        />
      </div>
      <ul className="mt-4 flex list-none gap-3" aria-label={`Views of ${name}`}>
        {images.map((image, index) => {
          const selected = index === safeIndex;
          const showThumb = !selected && revealed.has(index);
          return (
            <li key={`${image.src}-${index}`}>
              <button
                type="button"
                onClick={() => setActive(index)}
                onFocus={() => reveal(index)}
                onPointerEnter={() => reveal(index)}
                aria-pressed={selected}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                className={`relative h-20 w-20 overflow-hidden border ${
                  selected ? "border-forest" : "border-gold/70"
                }`}
              >
                {showThumb ? (
                  <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-serif text-lg text-forest">
                    {index + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
