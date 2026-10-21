import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectionPathsFromProducts } from "@/lib/orders/collection-paths";

describe("purchased collection paths", () => {
  test("uses the current category and additional collection slugs", () => {
    const paths = collectionPathsFromProducts([
      { category: "pashmina", collectionSlugs: ["kani", "winter-wraps"] },
      { category: "everyday", collectionSlugs: ["pashmina"] },
    ]);
    assert.deepEqual(paths, [
      "/collections/pashmina",
      "/collections/kani",
      "/collections/winter-wraps",
      "/collections/everyday",
    ]);
  });

  test("ignores empty and invalid slugs", () => {
    const paths = collectionPathsFromProducts([
      { category: "Not A Slug", collectionSlugs: ["", "ok-weave", "has space", 12] },
      { collectionSlugs: "kani" },
    ]);
    assert.deepEqual(paths, ["/collections/ok-weave"]);
  });

  test("checkout revalidates saved product collections rather than three fixed slugs", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const checkout = readFileSync(join(root, "app/(store)/checkout/actions.ts"), "utf8");
    const config = readFileSync(join(root, "next.config.ts"), "utf8");
    assert.match(checkout, /purchasedCollectionPaths\(result\.reference\)/);
    assert.doesNotMatch(checkout, /\/collections\/kani/);
    assert.match(config, /source: "\/orders\/:path\*"/);
    assert.match(config, /source: "\/checkout\/:path\*"/);
    assert.match(config, /private, no-store/);
  });
});
