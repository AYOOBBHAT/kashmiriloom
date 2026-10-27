"use client";

import Image, { type ImageProps } from "next/image";
import { cloudinaryImageLoader, isCloudinaryUploadUrl } from "@/lib/catalogue/cloudinary-delivery";

type CatalogueImageProps = Omit<ImageProps, "src" | "loader"> & {
  src: string;
};

export function CatalogueImage({ src, alt, ...props }: CatalogueImageProps) {
  if (isCloudinaryUploadUrl(src)) {
    return <Image {...props} alt={alt} src={src} loader={cloudinaryImageLoader} />;
  }
  return <Image {...props} alt={alt} src={src} />;
}
