"use server";

import { revalidatePath } from "next/cache";
import { expirePublicCatalogue } from "@/lib/catalogue/public-cache";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  createManagedCategory,
  deleteManagedCategory,
  setManagedCategoryActive,
  updateManagedCategory,
} from "@/lib/categories/admin";
import { CategoryInUseError, DuplicateCategoryError, validateCategoryDraft } from "@/lib/categories/records";
import { CatalogueAccessError, redactSecrets } from "@/lib/catalogue-error";
import { CATEGORY_SAVE_FAILED, failedCategory, type EnteredCategory } from "@/lib/catalogue/form-feedback";
import { AdminAccessError } from "@/lib/products/admin-repository";

export type CategoryFormState = {
  message: string;
  errors: Record<string, string>;
  entered?: EnteredCategory;
  attempt: number;
};

function revalidateCategories(slug?: string) {
  expirePublicCatalogue();
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  if (slug) {
    revalidatePath(`/collections/${slug}`);
  }
}

export async function saveCategory(
  id: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = validateCategoryDraft({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    imageAlt: formData.get("imageAlt"),
    active: formData.get("active") === "on",
    displayOrder: formData.get("displayOrder"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  if (!parsed.ok) {
    return failedCategory(_previous, formData, parsed.message, parsed.errors);
  }
  try {
    if (id) {
      const updated = await updateManagedCategory(id, parsed.value);
      if (!updated) {
        return failedCategory(_previous, formData, "That category is no longer available.", {});
      }
      revalidateCategories(parsed.value.slug);
      redirect(`/admin/categories/${id}/edit?saved=updated`);
    }
    const createdId = await createManagedCategory(parsed.value);
    revalidateCategories(parsed.value.slug);
    redirect(`/admin/categories/${createdId}/edit?saved=created`);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DuplicateCategoryError) {
      return failedCategory(_previous, formData, error.message, { slug: error.message });
    }
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return failedCategory(_previous, formData, error.message, {});
    }
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error(`Category save failed: ${redactSecrets(detail)}`);
    return failedCategory(_previous, formData, CATEGORY_SAVE_FAILED, {});
  }
}

export async function toggleCategory(id: string, active: boolean): Promise<{ message: string }> {
  try {
    const updated = await setManagedCategoryActive(id, active);
    revalidateCategories();
    return { message: updated ? (active ? "The category is active." : "The category is inactive.") : "That category is no longer available." };
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

export async function removeCategory(id: string): Promise<{ message: string }> {
  try {
    const removed = await deleteManagedCategory(id);
    revalidateCategories();
    return { message: removed ? "The empty category was deleted." : "That category is no longer available." };
  } catch (error) {
    if (error instanceof CategoryInUseError) {
      return { message: error.message };
    }
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      return { message: error.message };
    }
    throw error;
  }
}
