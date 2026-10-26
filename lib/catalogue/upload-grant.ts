export const CATALOGUE_IMAGE_FOLDER = "kashmiriloom";
export const CATALOGUE_IMAGE_FORMATS = "jpg,png,webp";
export const MAX_CATALOGUE_IMAGE_BYTES = 4_000_000;

export type CatalogueUploadGrant = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
};
