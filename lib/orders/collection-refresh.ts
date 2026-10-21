import "server-only";

import { isValidObjectId, type Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/lib/models/order";
import { Product } from "@/lib/models/product";
import { collectionPathsFromProducts } from "@/lib/orders/collection-paths";

export async function purchasedCollectionPaths(reference: string): Promise<string[]> {
  await connectToDatabase();
  const order = await Order.findOne({ publicReference: reference })
    .select("lines.productId")
    .lean<{ lines: Array<{ productId?: Types.ObjectId }> } | null>();
  const ids = (order?.lines ?? []).flatMap((line) =>
    line.productId && isValidObjectId(line.productId) ? [line.productId] : [],
  );
  if (ids.length === 0) {
    return [];
  }
  const products = await Product.find({ _id: { $in: ids } })
    .select("category collectionSlugs")
    .lean<Array<{ category?: string; collectionSlugs?: string[] }>>();
  return collectionPathsFromProducts(products);
}
