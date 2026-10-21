import { isSlug } from "@/lib/catalogue/slug";

export const MAX_SEARCH_LENGTH = 80;
export const MAX_PUBLIC_PRODUCTS = 48;

export type ShopCategory = string;
export type ShopSort = "edited" | "price-asc" | "price-desc" | "name";

export type ShopQuery = {
  search: string;
  category: ShopCategory;
  sort: ShopSort;
};

const sorts: ShopSort[] = ["edited", "price-asc", "price-desc", "name"];

export const emptyShopQuery: ShopQuery = {
  search: "",
  category: "all",
  sort: "edited",
};

function isSort(value: string): value is ShopSort {
  return sorts.some((sort) => sort === value);
}

export function parseShopQuery(input: {
  search?: string;
  category?: string;
  sort?: string;
}): { ok: true; query: ShopQuery } | { ok: false; message: string } {
  const search = (input.search ?? "").trim();
  if (search.length > MAX_SEARCH_LENGTH) {
    return {
      ok: false,
      message: `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`,
    };
  }

  const category = (input.category ?? "").trim().toLowerCase() || "all";
  if (category !== "all" && !isSlug(category)) {
    return { ok: false, message: "That category is not in this catalogue." };
  }

  const sort = input.sort?.trim() || "edited";
  if (!isSort(sort)) {
    return { ok: false, message: "That sort is not available." };
  }

  return { ok: true, query: { search, category, sort } };
}

export function shopHref(query: ShopQuery): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.category !== "all") {
    params.set("category", query.category);
  }
  if (query.sort !== "edited") {
    params.set("sort", query.sort);
  }
  const value = params.toString();
  return value ? `/shop?${value}` : "/shop";
}

export function matchesCatalogueSearch(
  product: { name: string; description: string },
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (needle.length > MAX_SEARCH_LENGTH) {
    return false;
  }
  return `${product.name} ${product.description}`.toLowerCase().includes(needle);
}
