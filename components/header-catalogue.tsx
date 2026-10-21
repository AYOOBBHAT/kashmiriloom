import { listPublicCategories } from "@/lib/categories/public";
import { listActiveProducts, withCatalogue } from "@/lib/products/repository";
import { CatalogueBridge } from "@/components/catalogue-bridge";
import { SiteHeader } from "@/components/site-header";

export async function HeaderCatalogue() {
  const [result, categories] = await Promise.all([
    withCatalogue(() => listActiveProducts()),
    withCatalogue(() => listPublicCategories()),
  ]);
  const navCategories = categories.ok ? categories.data.map((category) => ({ slug: category.slug, name: category.name })) : [];
  if (!result.ok) {
    return (
      <>
        <CatalogueBridge status="unavailable" products={[]} categories={navCategories} message={result.problem.message} />
        <SiteHeader />
      </>
    );
  }

  return (
    <>
      <CatalogueBridge status="ready" products={result.data} categories={navCategories} message={null} />
      <SiteHeader />
    </>
  );
}
