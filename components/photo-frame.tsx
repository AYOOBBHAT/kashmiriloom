"use client";

import { useState, type SyntheticEvent } from "react";
import { CatalogueImage } from "@/components/catalogue-image";

type PhotoFrameProps = {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  sizes: string;
  quality?: number;
  preload?: boolean;
  loading?: "eager" | "lazy";
};

function knownSize(width?: number | null, height?: number | null): { width: number; height: number } | null {
  if (!width || !height || width < 1 || height < 1) {
    return null;
  }
  return { width, height };
}

/**
 * The frame uses this photograph's own proportions.
 * A full-length shawl, a square studio photo, and a landscape textile each keep their shape.
 */
export function PhotoFrame({ src, alt, width, height, sizes, quality = 60, preload = false, loading }: PhotoFrameProps) {
  const supplied = knownSize(width, height);
  const [measured, setMeasured] = useState<{ src: string; width: number; height: number } | null>(null);
  const box = measured?.src === src ? measured : supplied;

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      return;
    }
    const nextRatio = image.naturalWidth / image.naturalHeight;
    if (box && Math.abs(box.width / box.height - nextRatio) < 0.005) {
      return;
    }
    setMeasured({ src, width: image.naturalWidth, height: image.naturalHeight });
  }

  return (
    <div
      className="relative w-full overflow-hidden bg-forest/5"
      style={{ aspectRatio: box ? `${box.width} / ${box.height}` : "3 / 4" }}
    >
      <CatalogueImage
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={quality}
        preload={preload}
        loading={loading}
        className="object-contain"
        onLoad={handleLoad}
      />
    </div>
  );
}
