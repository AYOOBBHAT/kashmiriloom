"use client";

import { prepareCatalogueImageUpload, type UploadState } from "@/app/admin/actions";
import { postCatalogueImage } from "@/lib/catalogue/browser-upload";

export async function uploadCatalogueImageFile(file: File): Promise<UploadState> {
  const prepared = await prepareCatalogueImageUpload();
  if (!prepared.ok) {
    return { message: prepared.message, url: "" };
  }
  const uploaded = await postCatalogueImage(file, prepared.upload);
  if (!uploaded.ok) {
    return { message: uploaded.message, url: "" };
  }
  return { message: "", url: uploaded.url };
}
