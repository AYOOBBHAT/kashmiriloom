"use server";

import { revalidatePath } from "next/cache";
import { expirePublicCatalogue } from "@/lib/catalogue/public-cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { checkAdminCredentials } from "@/lib/auth/credentials";
import { clientAddress } from "@/lib/auth/rate-limit";
import { createAdminSession, destroyAdminSession, getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError, redactSecrets } from "@/lib/catalogue-error";
import { PRODUCT_SAVE_FAILED, failedProduct, type EnteredProduct } from "@/lib/catalogue/form-feedback";
import { issueCatalogueUploadGrant } from "@/lib/cloudinary";
import type { CatalogueUploadGrant } from "@/lib/catalogue/upload-grant";
import {
  AdminAccessError,
  CategoryReferenceError,
  DuplicateProductError,
  createAdminProduct,
  deactivateAdminProduct,
  updateAdminProduct,
} from "@/lib/products/admin-repository";
import { validateProductDraft, type FieldErrors } from "@/lib/products/validate";

export type AuthFormState = { message: string };
export type ProductFormState = {
  message: string;
  errors: FieldErrors;
  entered?: EnteredProduct;
  attempt: number;
};
export type UploadState = { message: string; url: string };

function imagesFromForm(formData: FormData) {
  const urls = formData.getAll("imageUrl");
  const alts = formData.getAll("imageAlt");
  const primary = Number(formData.get("primaryImage"));
  return urls.map((url, index) => ({
    url,
    alt: alts[index] ?? "",
    primary: index === primary,
  }));
}

function revalidateCatalogue(slug: string, category: string, collections: string[]) {
  expirePublicCatalogue();
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath(`/collections/${category}`);
  for (const extra of collections) {
    revalidatePath(`/collections/${extra}`);
  }
}

export async function signIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = await checkAdminCredentials(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
    clientAddress(await headers()),
  );
  if (!result.ok) {
    return { message: result.message };
  }
  await createAdminSession(result.adminId);
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

export async function saveProduct(
  id: string,
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = validateProductDraft({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    shortDescription: formData.get("shortDescription"),
    category: formData.get("category"),
    collectionSlugs: formData.getAll("collectionSlug"),
    priceRupees: formData.get("priceRupees"),
    compareAtRupees: formData.get("compareAtRupees"),
    sku: formData.get("sku"),
    stockQuantity: formData.get("stockQuantity"),
    status: formData.get("status"),
    featured: formData.get("featured") === "on",
    images: imagesFromForm(formData),
    material: formData.get("material"),
    dimensions: formData.get("dimensions"),
    care: formData.get("care"),
    color: formData.get("color"),
    weave: formData.get("weave"),
    embroidery: formData.get("embroidery"),
    size: formData.get("size"),
    variantGroup: formData.get("variantGroup"),
    variantLabel: formData.get("variantLabel"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    linkSourceId: formData.get("linkSourceId"),
  });
  if (!parsed.ok) {
    return failedProduct(_previous, formData, parsed.message, parsed.errors);
  }

  try {
    if (id) {
      const updated = await updateAdminProduct(id, parsed.value);
      if (!updated) {
        return failedProduct(_previous, formData, "That shawl is no longer in the catalogue.", {});
      }
    } else {
      const createdId = await createAdminProduct(parsed.value);
      revalidateCatalogue(parsed.value.slug, parsed.value.category, parsed.value.collectionSlugs);
      redirect(`/admin/products/${createdId}/edit?saved=created`);
    }
    revalidateCatalogue(parsed.value.slug, parsed.value.category, parsed.value.collectionSlugs);
    redirect(`/admin/products/${id}/edit?saved=updated`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DuplicateProductError) {
      return failedProduct(_previous, formData, error.message, { [error.field]: error.message });
    }
    if (error instanceof CategoryReferenceError) {
      return failedProduct(_previous, formData, error.message, { category: error.message });
    }
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return failedProduct(_previous, formData, error.message, {});
    }
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`Product save failed: ${redactSecrets(detail)}`);
    return failedProduct(_previous, formData, PRODUCT_SAVE_FAILED, {});
  }
}

export async function deactivateProduct(id: string): Promise<{ message: string }> {
  try {
    const updated = await deactivateAdminProduct(id);
    if (!updated) {
      return { message: "That shawl is no longer in the catalogue." };
    }
    expirePublicCatalogue();
    revalidatePath("/", "layout");
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    return { message: "The shawl is archived and hidden from the shop. The record stays, including any past orders." };
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return { message: error.message };
    }
    throw error;
  }
}

export async function prepareCatalogueImageUpload(): Promise<
  { ok: true; upload: CatalogueUploadGrant } | { ok: false; message: string }
> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  const upload = issueCatalogueUploadGrant();
  if (!upload) {
    return {
      ok: false,
      message:
        "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server, or choose an existing photograph.",
    };
  }
  return { ok: true, upload };
}
