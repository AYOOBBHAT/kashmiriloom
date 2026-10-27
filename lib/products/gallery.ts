export type GalleryImage = {
  url: string;
  alt: string;
  primary?: boolean;
};

export function withPrimaryImage<T extends { primary?: boolean }>(images: T[]): T[] {
  if (images.length === 0) {
    return images;
  }
  const chosen = images.findIndex((image) => image.primary === true);
  const index = chosen >= 0 ? chosen : 0;
  return images.map((image, position) => ({ ...image, primary: position === index }));
}

export function primaryOf<T extends { primary?: boolean }>(images: T[]): T | undefined {
  return images.find((image) => image.primary) ?? images[0];
}

/** Every photograph on the product is part of the gallery. The catalogue ceiling is enforced before save. */
export function visibleGalleryImages<T>(images: readonly T[]): T[] {
  return [...images];
}
