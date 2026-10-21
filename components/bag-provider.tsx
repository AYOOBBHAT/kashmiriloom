"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  BAG_STORAGE_KEY,
  addBagLine,
  bagCount,
  bagSubtotal,
  parseBag,
  removeBagLine,
  setBagQuantity,
  type BagLine,
} from "@/lib/bag";
import { getCatalogueSnapshot, useCatalogue } from "@/lib/catalogue-store";
import type { ProductDto } from "@/lib/products/types";

const BAG_CHANGE_EVENT = "kashmiriloom-bag-change";

type AddResult =
  | { ok: true; clamped: boolean }
  | { ok: false; reason: "unknown" | "unavailable" | "loading" };

type BagContextValue = {
  lines: BagLine[];
  count: number;
  subtotalPaise: number | null;
  catalogueStatus: "loading" | "ready" | "unavailable";
  catalogueMessage: string | null;
  productFor: (slug: string) => ProductDto | undefined;
  add: (slug: string, quantity?: number) => AddResult;
  setQuantity: (slug: string, quantity: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const BagContext = createContext<BagContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  window.addEventListener(BAG_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(BAG_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readBagRaw() {
  try {
    return window.localStorage.getItem(BAG_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function readServerBag() {
  return "";
}

function knownSlugs(products: ProductDto[] | null) {
  if (!products) {
    return null;
  }
  return new Set(products.map((product) => product.slug));
}

function currentLines() {
  const catalogue = getCatalogueSnapshot();
  const known = catalogue.status === "ready" ? knownSlugs(catalogue.products) : null;
  return parseBag(readBagRaw() || null, known);
}

function writeBag(lines: BagLine[]) {
  try {
    window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(BAG_CHANGE_EVENT));
}

export function BagProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readBagRaw, readServerBag);
  const catalogue = useCatalogue();
  const readyProducts = catalogue.status === "ready" ? catalogue.products : null;
  const lines = useMemo(
    () => parseBag(raw || null, knownSlugs(readyProducts)),
    [raw, readyProducts],
  );

  useEffect(() => {
    if (!readyProducts) {
      return;
    }
    const stored = parseBag(readBagRaw() || null, null);
    const next = parseBag(readBagRaw() || null, knownSlugs(readyProducts));
    if (stored.length !== next.length) {
      writeBag(next);
    }
  }, [readyProducts]);

  const add = useCallback((slug: string, quantity = 1): AddResult => {
    const snapshot = getCatalogueSnapshot();
    if (snapshot.status === "loading") {
      return { ok: false, reason: "loading" };
    }
    if (snapshot.status === "unavailable") {
      return { ok: false, reason: "unavailable" };
    }
    const product = snapshot.products.find((item) => item.slug === slug);
    if (!product) {
      return { ok: false, reason: "unknown" };
    }
    if (!product.available) {
      return { ok: false, reason: "unavailable" };
    }
    const result = addBagLine(currentLines(), slug, quantity);
    writeBag(result.lines);
    return { ok: true, clamped: result.clamped };
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    writeBag(setBagQuantity(currentLines(), slug, quantity));
  }, []);

  const remove = useCallback((slug: string) => {
    writeBag(removeBagLine(currentLines(), slug));
  }, []);

  const clear = useCallback(() => {
    writeBag([]);
  }, []);

  const subtotalPaise = useMemo(() => {
    if (!readyProducts) {
      return null;
    }
    return bagSubtotal(lines, (slug) => {
      return readyProducts.find((product) => product.slug === slug)?.pricePaise ?? 0;
    });
  }, [lines, readyProducts]);

  const value = useMemo<BagContextValue>(
    () => ({
      lines,
      count: bagCount(lines),
      subtotalPaise: readyProducts ? subtotalPaise : null,
      catalogueStatus: catalogue.status,
      catalogueMessage: catalogue.message,
      productFor: (slug) => catalogue.products.find((product) => product.slug === slug),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [add, catalogue.message, catalogue.products, catalogue.status, clear, lines, readyProducts, remove, setQuantity, subtotalPaise],
  );

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag(): BagContextValue {
  const value = useContext(BagContext);
  if (!value) {
    throw new Error("useBag must be used within BagProvider");
  }
  return value;
}
