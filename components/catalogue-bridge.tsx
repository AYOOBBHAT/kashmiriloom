"use client";

import { useEffect } from "react";
import { publishCatalogue, type CatalogueNavCategory, type CatalogueStatus } from "@/lib/catalogue-store";
import type { ProductDto } from "@/lib/products/types";

type CatalogueBridgeProps = {
  status: CatalogueStatus;
  products: ProductDto[];
  categories: CatalogueNavCategory[];
  message: string | null;
};

export function CatalogueBridge({ status, products, categories, message }: CatalogueBridgeProps) {
  useEffect(() => {
    publishCatalogue({ status, products, categories, message });
  }, [categories, message, products, status]);

  return null;
}
