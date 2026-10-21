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
  const safeIndex = images[active] ? active : 0;
  const current = images[safeIndex];

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
          priority={safeIndex === 0}
          sizes="(min-width: 1024px) 48vw, 100vw"
          className="object-cover"
        />
      </div>
      <ul className="mt-4 flex list-none gap-3" aria-label={`Views of ${name}`}>
        {images.map((image, index) => {
          const selected = index === safeIndex;
          return (
            <li key={`${image.src}-${index}`}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={selected}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                className={`relative h-20 w-20 overflow-hidden border ${
                  selected ? "border-forest" : "border-gold/70"
                }`}
              >
                <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
