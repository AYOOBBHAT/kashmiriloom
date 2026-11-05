"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { cloudinaryImageLoader, isCloudinaryUploadUrl } from "@/lib/catalogue/cloudinary-delivery";
import { frameObjectFit } from "@/lib/catalogue/image-frame";

type CatalogueImageProps = Omit<ImageProps, "src" | "loader"> & {
  src: string;
  /**
   * Wide textile photos fill the frame. A photo taller than the frame stays whole,
   * because cover would cut the top and bottom of the shawl.
   */
  frame?: boolean;
};

export function CatalogueImage({ src, alt, frame = false, className, onLoad, ...props }: CatalogueImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [fit, setFit] = useState<"contain" | "cover" | null>(null);

  const settle = useCallback((image: HTMLImageElement) => {
    if (!frame || image.naturalWidth < 1 || image.clientWidth < 1 || image.clientHeight < 1) {
      return;
    }
    const next = frameObjectFit(image.naturalWidth, image.naturalHeight, image.clientWidth, image.clientHeight);
    setFit((current) => (current === next ? current : next));
  }, [frame]);

  useEffect(() => {
    const image = imageRef.current;
    if (!frame || !image) {
      return;
    }
    setFit(null);
    settle(image);
    const observer = new ResizeObserver(() => settle(image));
    observer.observe(image);
    return () => observer.disconnect();
  }, [frame, settle, src]);

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    settle(event.currentTarget);
    onLoad?.(event);
  }

  const fitClass = frame
    ? fit === "cover"
      ? "object-cover opacity-100 motion-safe:transition motion-safe:duration-700 motion-safe:group-hover:scale-105"
      : fit === "contain"
        ? "object-contain opacity-100"
        : "object-contain opacity-0"
    : undefined;
  const imageClass = [className, fitClass].filter(Boolean).join(" ") || undefined;
  const shared = {
    ...props,
    src,
    className: imageClass,
    onLoad: handleLoad,
    ref: imageRef,
  };

  if (isCloudinaryUploadUrl(src)) {
    return <Image {...shared} alt={alt} loader={cloudinaryImageLoader} />;
  }
  return <Image {...shared} alt={alt} />;
}
