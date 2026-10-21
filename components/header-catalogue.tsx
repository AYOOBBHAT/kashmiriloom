import { listActiveProducts, withCatalogue } from "@/lib/products/repository";
import { CatalogueBridge } from "@/components/catalogue-bridge";
import { SiteHeader } from "@/components/site-header";

export async function HeaderCatalogue() {
  const result = await withCatalogue(() => listActiveProducts());
  if (!result.ok) {
    return (
      <>
        <CatalogueBridge status="unavailable" products={[]} message={result.problem.message} />
        <SiteHeader />
      </>
    );
  }

  return (
    <>
      <CatalogueBridge status="ready" products={result.data} message={null} />
      <SiteHeader />
    </>
  );
}
