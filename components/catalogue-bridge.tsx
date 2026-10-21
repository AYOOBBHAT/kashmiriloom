"use client";

import { useEffect } from "react";
import { publishCatalogue, type CatalogueStatus } from "@/lib/catalogue-store";
import type { ProductDto } from "@/lib/products/types";

type CatalogueBridgeProps = {
  status: CatalogueStatus;
  products: ProductDto[];
  message: string | null;
};

export function CatalogueBridge({ status, products, message }: CatalogueBridgeProps) {
  useEffect(() => {
    publishCatalogue({ status, products, message });
  }, [message, products, status]);

  return null;
}
