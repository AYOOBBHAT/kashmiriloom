import "server-only";

import { seedCategories } from "@/lib/categories/defaults";
import { CatalogueAccessError, UNAVAILABLE_MESSAGE, redactSecrets } from "@/lib/catalogue-error";
import { connectToDatabase } from "@/lib/mongodb";
import { Category } from "@/lib/models/category";

export async function loadCategoryNames(): Promise<Map<string, string>> {
  const names = new Map(seedCategories.map((category) => [category.slug, category.name]));
  try {
    await connectToDatabase();
    const docs = await Category.find({}).select("slug name").limit(200).lean<Array<{ slug: string; name: string }>>();
    for (const category of docs) {
      names.set(category.slug, category.name);
    }
    return names;
  } catch (error) {
    if (error instanceof CatalogueAccessError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown database error";
    console.error(`Category query failed: ${redactSecrets(detail)}`);
    throw new CatalogueAccessError("unavailable", UNAVAILABLE_MESSAGE);
  }
}
