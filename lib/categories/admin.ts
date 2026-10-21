import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getCurrentAdmin } from "@/lib/auth/session";
import {
  categoryChoices,
  createCategoryRecord,
  deleteCategoryRecord,
  getCategoryRecord,
  listCategoryRecords,
  setCategoryActive,
  updateCategoryRecord,
  type CategoryDraft,
} from "@/lib/categories/records";
import { AdminAccessError } from "@/lib/products/admin-repository";
import { seedCategories } from "@/lib/categories/defaults";

async function authorize() {
  const admin = await getCurrentAdmin();
  try {
    requireAdmin(admin);
  } catch {
    throw new AdminAccessError();
  }
}

export async function listManagedCategories(search: string, page: number) {
  await authorize();
  return listCategoryRecords(search, page);
}

export async function managedCategoryChoices() {
  await authorize();
  const stored = await categoryChoices();
  if (stored.length > 0) {
    return stored;
  }
  return seedCategories.map((category) => ({
    slug: category.slug,
    name: category.name,
    active: true,
  }));
}

export async function getManagedCategory(id: string) {
  await authorize();
  return getCategoryRecord(id);
}

export async function createManagedCategory(draft: CategoryDraft) {
  await authorize();
  return createCategoryRecord(draft);
}

export async function updateManagedCategory(id: string, draft: CategoryDraft) {
  await authorize();
  return updateCategoryRecord(id, draft);
}

export async function setManagedCategoryActive(id: string, active: boolean) {
  await authorize();
  return setCategoryActive(id, active);
}

export async function deleteManagedCategory(id: string) {
  await authorize();
  return deleteCategoryRecord(id);
}
