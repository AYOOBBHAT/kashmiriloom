"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAdminCredentials } from "@/lib/auth/credentials";
import { clientAddress } from "@/lib/auth/rate-limit";
import { createAdminSession, destroyAdminSession, getCurrentAdmin } from "@/lib/auth/session";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { uploadCatalogueImage } from "@/lib/cloudinary";
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
export type ProductFormState = { message: string; errors: FieldErrors };
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

function revalidateCatalogue(slug: string, category: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath(`/collections/${category}`);
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
    return { message: parsed.message, errors: parsed.errors };
  }

  try {
    if (id) {
      const updated = await updateAdminProduct(id, parsed.value);
      if (!updated) {
        return { message: "That shawl is no longer in the catalogue.", errors: {} };
      }
    } else {
      const createdId = await createAdminProduct(parsed.value);
      revalidateCatalogue(parsed.value.slug, parsed.value.category);
      redirect(`/admin/products/${createdId}/edit?saved=1`);
    }
    revalidateCatalogue(parsed.value.slug, parsed.value.category);
    redirect(`/admin/products/${id}/edit?saved=1`);
  } catch (error) {
    if (error instanceof DuplicateProductError) {
      return {
        message: error.message,
        errors: { [error.field]: error.message },
      };
    }
    if (error instanceof CategoryReferenceError) {
      return { message: error.message, errors: { category: error.message } };
    }
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return { message: error.message, errors: {} };
    }
    throw error;
  }
}

export async function deactivateProduct(id: string): Promise<{ message: string }> {
  try {
    const updated = await deactivateAdminProduct(id);
    if (!updated) {
      return { message: "That shawl is no longer in the catalogue." };
    }
    revalidatePath("/");
    revalidatePath("/shop");
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

export async function uploadProductImage(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose an image file.", url: "" };
  }
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  try {
    const result = await uploadCatalogueImage(file);
    if (!result.ok) {
      return { message: result.message, url: "" };
    }
    return { message: "", url: result.url };
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      return { message: error.message, url: "" };
    }
    throw error;
  }
}
