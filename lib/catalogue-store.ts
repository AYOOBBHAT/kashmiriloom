"use client";

import { useSyncExternalStore } from "react";
import type { ProductDto } from "@/lib/products/types";

export type CatalogueStatus = "loading" | "ready" | "unavailable";

export type CatalogueSnapshot = {
  status: CatalogueStatus;
  products: ProductDto[];
  message: string | null;
};

const INITIAL: CatalogueSnapshot = {
  status: "loading",
  products: [],
  message: null,
};

let current: CatalogueSnapshot = INITIAL;
const listeners = new Set<() => void>();

function sameSnapshot(left: CatalogueSnapshot, right: CatalogueSnapshot): boolean {
  if (left.status !== right.status || left.message !== right.message) {
    return false;
  }
  if (left.products.length !== right.products.length) {
    return false;
  }
  return left.products.every((product, index) => {
    const other = right.products[index];
    return (
      other?.slug === product.slug &&
      other.pricePaise === product.pricePaise &&
      other.available === product.available &&
      other.name === product.name &&
      other.stockQuantity === product.stockQuantity
    );
  });
}

export function publishCatalogue(next: CatalogueSnapshot) {
  if (sameSnapshot(current, next)) {
    return;
  }
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getCatalogueSnapshot(): CatalogueSnapshot {
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCatalogue(): CatalogueSnapshot {
  return useSyncExternalStore(subscribe, getCatalogueSnapshot, () => INITIAL);
}
