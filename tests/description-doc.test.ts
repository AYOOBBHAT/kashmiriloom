import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  descriptionDocumentFromEditor,
  descriptionMatches,
  documentFromPlain,
  editorContentFromDocument,
  parseDescriptionDocument,
  parseDescriptionJson,
  plainText,
  type DescriptionDocument,
} from "@/lib/products/description-doc";
import { validateProductDraft } from "@/lib/products/validate";
import { productPageJsonLd, type StructuredProduct } from "@/lib/site/structured-data";

const formatted: DescriptionDocument = {
  version: 1,
  blocks: [
    { type: "paragraph", content: [{ text: "A wool shawl." }] },
    { type: "heading", level: 2, content: [{ text: "How to wear it" }] },
    { type: "heading", level: 3, content: [{ text: "Evening", italic: true }] },
    { type: "bulletList", items: [[{ text: "Fold once", bold: true }], [{ text: "Drape the border" }]] },
    { type: "orderedList", items: [[{ text: "Air it" }], [{ text: "Fold embroidery inward" }]] },
    { type: "note", content: [{ text: "This is care guidance, not a warranty." }] },
  ],
};

function productInput(description: string, descriptionDocument?: unknown) {
  return {
    name: "Test shawl",
    slug: "test-shawl",
    description,
    descriptionDocument,
    shortDescription: "",
    category: "kani",
    collectionSlugs: [],
    priceRupees: "5000",
    compareAtRupees: "",
    sku: "KL-DESC-1",
    stockQuantity: "1",
    status: "draft",
    featured: false,
    images: [{ url: "/images/shawl-nishat.jpg", alt: "A test photograph", primary: true }],
    material: "",
    dimensions: "",
    care: "",
    color: "",
    weave: "",
    embroidery: "",
    size: "",
    variantGroup: "",
    variantLabel: "",
    expectedUpdatedAt: "",
    linkSourceId: "",
  };
}

describe("product description documents", () => {
  test("keeps an existing plain description and renders it as one paragraph", () => {
    const legacy = documentFromPlain("Burgundy ground with large gold paisleys.");
    assert.equal(legacy?.blocks.length, 1);
    assert.equal(legacy?.blocks[0]?.type, "paragraph");
    assert.equal(plainText(legacy!), "Burgundy ground with large gold paisleys.");
    const view = readFileSync("components/product-description.tsx", "utf8");
    assert.match(view, /descriptionMatches/);
    assert.match(view, /<p/);
    assert.match(view, /"h2"/);
    assert.match(view, /"h3"/);
    assert.match(view, /"ul"/);
    assert.match(view, /"ol"/);
    assert.match(view, /<strong/);
    assert.match(view, /<aside/);
    assert.doesNotMatch(view, /dangerouslySetInnerHTML/);
    const draft = validateProductDraft(productInput("Burgundy ground with large gold paisleys."));
    assert.equal(draft.ok, true);
    if (draft.ok) {
      assert.equal(draft.value.description, "Burgundy ground with large gold paisleys.");
      assert.equal(draft.value.descriptionDocument, undefined);
    }
  });

  test("saves formatted text as plain words plus a versioned document", () => {
    const draft = validateProductDraft(productInput("ignore this", formatted));
    assert.equal(draft.ok, true);
    if (!draft.ok) {
      return;
    }
    assert.equal(draft.value.descriptionDocument?.version, 1);
    assert.equal(draft.value.description.includes("<"), false);
    assert.match(draft.value.description, /How to wear it/);
    assert.match(draft.value.description, /Fold once/);
    assert.equal(descriptionMatches(formatted, draft.value.description), true);
    const restored = parseDescriptionJson(JSON.stringify(draft.value.descriptionDocument));
    assert.deepEqual(restored, formatted);
    assert.deepEqual(descriptionDocumentFromEditor(editorContentFromDocument(formatted)), formatted);
  });

  test("rejects script markup, unexpected fields, and a mismatched stored document", () => {
    assert.equal(parseDescriptionDocument({ version: 1, blocks: [{ type: "html", html: "<script>alert(1)</script>" }] }), null);
    assert.equal(
      parseDescriptionDocument({
        version: 1,
        blocks: [{ type: "paragraph", content: [{ text: "Safe", href: "javascript:alert(1)" }] }],
      }),
      null,
    );
    assert.equal(parseDescriptionDocument({ version: 2, blocks: [{ type: "paragraph", content: [{ text: "No" }] }] }), null);
    assert.equal(parseDescriptionJson("<script>alert(1)</script>"), null);
    const hostile = descriptionDocumentFromEditor({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
        },
        { type: "image", attrs: { src: "https://evil.example/x.png" } },
      ],
    });
    assert.equal(hostile?.blocks.length, 1);
    assert.equal(hostile?.blocks[0]?.type, "paragraph");
    if (hostile?.blocks[0]?.type === "paragraph") {
      assert.equal(hostile.blocks[0].content[0]?.text, "<script>alert(1)</script>");
      assert.equal(hostile.blocks[0].content[0]?.bold, undefined);
      assert.equal(JSON.stringify(hostile).includes("javascript:"), false);
      assert.equal(JSON.stringify(hostile).includes("href"), false);
    }
    assert.equal(descriptionMatches(formatted, "The saved plain description."), false);
    assert.equal(documentFromPlain("The saved plain description.")?.blocks[0]?.type, "paragraph");
    const draft = validateProductDraft(productInput("A shawl.", { version: 1, blocks: [{ type: "paragraph", content: [{ text: "Ok", onclick: "alert(1)" }] }] }));
    assert.equal(draft.ok, false);
  });

  test("keeps product metadata and JSON-LD on the plain description", () => {
    const text = plainText(formatted);
    const shawl: StructuredProduct = {
      name: "Nishat",
      description: text,
      slug: "nishat",
      sku: "KL-SAMPLE-NISHAT",
      pricePaise: 500_000,
      available: true,
      category: "kani",
      categoryName: "Kani shawls",
      images: [{ src: "/images/shawl-nishat.jpg" }],
    };
    const data = productPageJsonLd(shawl);
    const graph = data?.["@graph"] as Array<Record<string, unknown>>;
    const product = graph.find((item) => item["@type"] === "Product");
    assert.equal(product?.description, text);
    assert.equal(String(product?.description).includes("<"), false);
    const page = readFileSync("app/(store)/products/[slug]/page.tsx", "utf8");
    const metadata = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("async function ProductDetail"));
    assert.match(metadata, /product\.summary/);
    assert.doesNotMatch(metadata, /descriptionDocument/);
    assert.match(page, /<ProductDescription/);
    assert.match(readFileSync("components/admin/description-editor.tsx", "utf8"), /Undo/);
    assert.match(readFileSync("components/admin/description-editor.tsx", "utf8"), /link: false/);
  });
});
