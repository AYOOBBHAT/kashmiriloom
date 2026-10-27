import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { canonicalImageUrl, productPageJsonLd, rupeesFromPaise, serializeJsonLd, type StructuredProduct } from "@/lib/site/structured-data";

const shawl: StructuredProduct = {
  name: "Nishat",
  description: "A woven shawl.",
  slug: "nishat",
  sku: "KL-SAMPLE-NISHAT",
  pricePaise: 125_050,
  available: true,
  category: "kani",
  categoryName: "Kani shawls",
  images: [{ src: "/images/shawl-nishat.jpg" }, { src: "https://res.cloudinary.com/demo/image/upload/nishat.jpg" }],
};

describe("product structured data", () => {
  test("uses the catalogue price, INR, and the canonical product URL", () => {
    const data = productPageJsonLd(shawl);
    assert.ok(data);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const product = graph.find((item) => item["@type"] === "Product");
    const offer = product?.offers as Record<string, unknown>;
    assert.equal(product?.name, "Nishat");
    assert.equal(product?.sku, "KL-SAMPLE-NISHAT");
    assert.equal(product?.url, "https://kashmiriloom.com/products/nishat");
    assert.equal(offer.priceCurrency, "INR");
    assert.equal(offer.price, "1250.50");
    assert.equal(offer.price, rupeesFromPaise(125_050));
    assert.equal(offer.availability, "https://schema.org/InStock");
    assert.deepEqual(product?.image, [
      "https://kashmiriloom.com/images/shawl-nishat.jpg",
      "https://res.cloudinary.com/demo/image/upload/nishat.jpg",
    ]);
    assert.equal(JSON.stringify(data).includes("aggregateRating"), false);
    assert.equal(JSON.stringify(data).includes("review"), false);
  });

  test("marks an unavailable shawl out of stock", () => {
    const data = productPageJsonLd({ ...shawl, available: false, pricePaise: 125_000 });
    assert.ok(data);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const product = graph.find((item) => item["@type"] === "Product");
    const offer = product?.offers as Record<string, unknown>;
    assert.equal(offer.price, "1250.00");
    assert.equal(offer.availability, "https://schema.org/OutOfStock");
    assert.notEqual(offer.availability, "https://schema.org/InStock");
  });

  test("omits structured data when the product or price is not valid", () => {
    assert.equal(productPageJsonLd(null), null);
    assert.equal(productPageJsonLd({ ...shawl, slug: "Not a slug" }), null);
    assert.equal(productPageJsonLd({ ...shawl, pricePaise: -1 }), null);
    assert.equal(productPageJsonLd({ ...shawl, name: "  " }), null);
  });

  test("escapes text that could close the script tag", () => {
    const data = productPageJsonLd({
      ...shawl,
      name: "</script><script>alert(1)</script>",
      description: "A shawl & a note",
    });
    const html = serializeJsonLd(data);
    assert.equal(html.includes("</script>"), false);
    assert.equal(html.includes("<script"), false);
    assert.equal(html.includes("&"), false);
    assert.match(html, /\\u003c\/script\\u003e/);
  });

  test("encodes a public image path that contains spaces and commas", () => {
    const src = "/Kani shawls/1.18/ChatGPT Image 22 Oct 2026, 22_32_34.png";
    assert.equal(
      canonicalImageUrl(src),
      "https://kashmiriloom.com/Kani%20shawls/1.18/ChatGPT%20Image%2022%20Oct%202026%2C%2022_32_34.png",
    );
    assert.equal(canonicalImageUrl(encodeURI(src)), canonicalImageUrl(src));
    const data = productPageJsonLd({ ...shawl, images: [{ src }] });
    assert.ok(data);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const product = graph.find((item) => item["@type"] === "Product");
    assert.deepEqual(product?.image, [canonicalImageUrl(src)]);
    assert.equal(canonicalImageUrl("/Kani shawls/../secret.png"), null);
    assert.equal(canonicalImageUrl("/Kani%20shawls/%2e%2e/secret.png"), null);
    assert.equal(canonicalImageUrl("/Kani shawls/%2e%2e/secret.png"), null);
    assert.equal(canonicalImageUrl("/Kani%5cshawls/photo.png"), null);
    assert.equal(canonicalImageUrl("//kashmiriloom.com/images/shawl-nishat.jpg"), null);
  });

  test("matches the visible shop, collection, and product breadcrumb", () => {
    const data = productPageJsonLd(shawl);
    assert.ok(data);
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    const crumbs = graph.find((item) => item["@type"] === "BreadcrumbList");
    const items = crumbs?.itemListElement as Array<Record<string, unknown>>;
    assert.deepEqual(
      items.map((item) => item.item),
      [
        "https://kashmiriloom.com/shop",
        "https://kashmiriloom.com/collections/kani",
        "https://kashmiriloom.com/products/nishat",
      ],
    );
    assert.deepEqual(
      items.map((item) => item.name),
      ["Shop", "Kani shawls", "Nishat"],
    );
  });
});
