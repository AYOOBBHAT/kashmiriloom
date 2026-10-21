import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_ROBOT_PATHS } from "@/lib/site/robots-rules";
import { absoluteUrl, publicSitemapEntries } from "@/lib/site/sitemap-entries";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("public SEO addresses", () => {
  test("builds one canonical shop address and keeps query variants off it", () => {
    assert.equal(absoluteUrl("/"), "https://kashmiriloom.com");
    assert.equal(absoluteUrl("/shop"), "https://kashmiriloom.com/shop");
    assert.equal(absoluteUrl("/shop").includes("?"), false);
    const shop = readFileSync(join(root, "app/(store)/shop/page.tsx"), "utf8");
    assert.match(shop, /canonical: absoluteUrl\("\/shop"\)/);
    assert.doesNotMatch(shop, /canonical:.*searchParams/);
  });

  test("lists active catalogue URLs and skips private, invalid, and unsellable rows", () => {
    const edited = new Date("2026-03-01T00:00:00.000Z");
    const entries = publicSitemapEntries({
      categories: [
        { slug: "pashmina", updatedAt: edited },
        { slug: "pashmina" },
        { slug: "Not A Slug" },
        { slug: "everyday" },
      ],
      products: [
        { slug: "nishat", currency: "INR", pricePaise: 125_000, updatedAt: edited },
        { slug: "nishat", currency: "INR", pricePaise: 125_000 },
        { slug: "draft-shawl", currency: "USD", pricePaise: 125_000 },
        { slug: "bad price", currency: "INR", pricePaise: 10 },
        { slug: "missing-price", currency: "INR" },
      ],
    });
    assert.deepEqual(
      entries.map((entry) => entry.url),
      [
        "https://kashmiriloom.com",
        "https://kashmiriloom.com/shop",
        "https://kashmiriloom.com/collections/pashmina",
        "https://kashmiriloom.com/collections/everyday",
        "https://kashmiriloom.com/products/nishat",
      ],
    );
    assert.equal(entries[2]?.lastModified?.toISOString(), edited.toISOString());
    assert.equal(entries[3]?.lastModified, undefined);
    assert.equal(entries.some((entry) => entry.url.includes("/admin") || entry.url.includes("/checkout")), false);
  });

  test("points robots at the sitemap and away from private routes", () => {
    const robots = readFileSync(join(root, "app/robots.ts"), "utf8");
    const product = readFileSync(join(root, "app/(store)/products/[slug]/page.tsx"), "utf8");
    const collection = readFileSync(join(root, "app/(store)/collections/[slug]/page.tsx"), "utf8");
    assert.equal(absoluteUrl("/sitemap.xml"), "https://kashmiriloom.com/sitemap.xml");
    assert.match(robots, /sitemap: absoluteUrl\("\/sitemap.xml"\)/);
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/admin"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/account"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/checkout"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/orders"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/login"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/register"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/forgot-password"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/reset-password"));
    assert.ok(PRIVATE_ROBOT_PATHS.includes("/auth"));
    assert.match(product, /kind === "missing"/);
    assert.match(product, /canonical: absoluteUrl\(`\/products\/\$\{result\.data\.product\.slug\}`\)/);
    assert.doesNotMatch(product, /canonical: absoluteUrl\("\/"\)/);
    assert.match(collection, /canonical: absoluteUrl\(`\/collections\/\$\{result\.data\.slug\}`\)/);
    assert.doesNotMatch(collection, /generateStaticParams/);
  });
});
