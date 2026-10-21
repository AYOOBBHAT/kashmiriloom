import type { CollectionId } from "@/data/catalog";

export const ADMIN_PAGE_SIZE = 10;
export const LOW_STOCK_AT = 3;

export type AdminStatusFilter = "all" | "active" | "inactive";
export type AdminCategoryFilter = CollectionId | "all";

export type AdminListQuery = {
  search: string;
  category: AdminCategoryFilter;
  status: AdminStatusFilter;
  page: number;
};

const categories: AdminCategoryFilter[] = ["all", "kani", "embroidered", "everyday"];
const statuses: AdminStatusFilter[] = ["all", "active", "inactive"];

function isCategory(value: string): value is AdminCategoryFilter {
  return categories.some((category) => category === value);
}

function isStatus(value: string): value is AdminStatusFilter {
  return statuses.some((status) => status === value);
}

export function parseAdminListQuery(input: {
  search?: string;
  category?: string;
  status?: string;
  page?: string;
}): { ok: true; query: AdminListQuery } | { ok: false; message: string } {
  const search = (input.search ?? "").trim();
  if (search.length > 80) {
    return { ok: false, message: "Search must be 80 characters or fewer." };
  }
  const category = input.category?.trim() || "all";
  if (!isCategory(category)) {
    return { ok: false, message: "That category is not in this catalogue." };
  }
  const status = input.status?.trim() || "all";
  if (!isStatus(status)) {
    return { ok: false, message: "That status filter is not available." };
  }
  const pageText = input.page?.trim() || "1";
  if (!/^\d{1,4}$/.test(pageText)) {
    return { ok: false, message: "That page is not available." };
  }
  const page = Number(pageText);
  if (!Number.isInteger(page) || page < 1 || page > 1000) {
    return { ok: false, message: "That page is not available." };
  }
  return { ok: true, query: { search, category, status, page } };
}

export function adminListHref(query: AdminListQuery): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.category !== "all") {
    params.set("category", query.category);
  }
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.page > 1) {
    params.set("page", String(query.page));
  }
  const value = params.toString();
  return value ? `/admin/products?${value}` : "/admin/products";
}
