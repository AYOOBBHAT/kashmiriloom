import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { discoverShawls, importerImagePatch, importSku, importSlug, planShawlImport } from "@/lib/catalogue/shawl-import";
import { visibleGalleryImages } from "@/lib/products/gallery";
import { isApprovedImageUrl } from "@/lib/products/images";
import { MAX_PRODUCT_IMAGES } from "@/lib/products/limits";
import { parseInrToPaise } from "@/lib/products/validate";
import { productShownPublicly } from "@/lib/catalogue/visibility";

const root = await mkdtemp(path.join(tmpdir(), "shawl-import-"));

after(async () => {
  await rm(root, { recursive: true, force: true });
});

async function touch(file: string) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "png");
}

describe("shawl import planning", () => {
  test("discovers one product per shawl folder and keeps image order", async () => {
    await touch(path.join(root, "Kani shawls", "1.18", "b.png"));
    await touch(path.join(root, "Kani shawls", "1.18", "a.png"));
    await touch(path.join(root, "Kani shawls", "1.20", "only.webp"));
    await touch(path.join(root, "Kani shawls", "notes.txt"));
    await mkdir(path.join(root, "Zari shawls", "1.1"), { recursive: true });
    await touch(path.join(root, "Machine embroidery", "1.12", "skip.pdf"));
    for (let index = 0; index < 7; index += 1) {
      await touch(path.join(root, "Machine embroidery", "1.12", `${index}.png`));
    }

    const shawls = await discoverShawls(root);
    const kani = shawls.find((shawl) => shawl.folderName === "1.18");
    assert.ok(kani);
    assert.deepEqual(kani.images.map((image) => image.name), ["a.png", "b.png"]);
    assert.equal(kani.images[0]?.url, "/Kani shawls/1.18/a.png");
    assert.equal(isApprovedImageUrl(kani.images[0]?.url ?? ""), true);
    const empty = shawls.find((shawl) => shawl.sourceDirectory === "Zari shawls");
    assert.equal(empty?.images.length, 0);
    const machine = shawls.find((shawl) => shawl.folderName === "1.12");
    assert.equal(machine?.images.length, 7);
    assert.deepEqual(machine?.skippedFiles, ["skip.pdf"]);
    const planned = planShawlImport({
      shawls: machine ? [machine] : [],
      categories: [{ slug: "machine-embroidery", name: "Machine embroidery" }],
      products: [],
      update: false,
    });
    assert.equal(planned[0]?.draft?.images.length, 7);
    assert.equal(planned[0]?.draft?.images[0]?.primary, true);
    assert.equal(planned[0]?.draft?.omittedImages.length, 0);
    assert.equal(planned[0]?.draft?.status, "draft");
  });

  test("prices a draft at 500000 paise and does not repeat or overwrite a different product", () => {
    assert.equal(parseInrToPaise("5000"), 500_000);
    assert.equal(importSlug("kani", "1.18"), "kani-1-18");
    assert.equal(importSku("kani", "1.18"), "KL-KANI-1-18");
    const shawl = {
      sourceDirectory: "Kani shawls",
      folderName: "1.18",
      relativeFolder: "1.18",
      images: [
        { name: "b.png", relativePath: "b.png", url: "/Kani shawls/1.18/b.png" },
        { name: "a.png", relativePath: "a.png", url: "/Kani shawls/1.18/a.png" },
      ],
      skippedFiles: [],
      notes: [],
    };
    const categories = [{ slug: "kani", name: "Kani shawls" }];
    const first = planShawlImport({ shawls: [shawl], categories, products: [], update: false });
    assert.equal(first[0]?.action, "create");
    assert.equal(first[0]?.draft?.pricePaise, 500_000);
    assert.equal(first[0]?.draft?.stockQuantity, 1);
    assert.equal(first[0]?.draft?.status, "draft");
    assert.equal(first[0]?.draft?.active, false);
    assert.equal(first[0]?.draft?.featured, false);
    assert.equal(first[0]?.draft?.images[0]?.primary, true);
    assert.equal(first[0]?.draft?.images[0]?.url, "/Kani shawls/1.18/a.png");
    assert.equal(productShownPublicly("draft"), false);
    assert.match(first[0]?.draft?.description ?? "", /Kani shawls/);
    assert.doesNotMatch(first[0]?.draft?.description ?? "", /pashmina|cashmere|handwoven|handmade|authentic/i);

    const again = planShawlImport({
      shawls: [shawl],
      categories,
      products: [{ slug: "kani-1-18", sku: "KL-KANI-1-18" }],
      update: false,
    });
    assert.equal(again[0]?.action, "already-imported");
    const conflict = planShawlImport({
      shawls: [shawl],
      categories,
      products: [{ slug: "kani-1-18", sku: "KL-MANUAL" }],
      update: false,
    });
    assert.equal(conflict[0]?.action, "conflict");
    const missing = planShawlImport({
      shawls: [{ ...shawl, sourceDirectory: "Sozni shawls", images: shawl.images }],
      categories,
      products: [],
      update: false,
    });
    assert.equal(missing[0]?.action, "missing-category");
    assert.equal(isApprovedImageUrl("/Kani shawls/1.18/ChatGPT Image 22 Oct 2026, 22_32_34.png"), true);
    assert.equal(isApprovedImageUrl("/Kani%20shawls/1.18/ChatGPT%20Image%2022%20Oct%202026%2C%2022_32_34.png"), true);
    assert.equal(isApprovedImageUrl("/Kani shawls/../secret.png"), false);
    assert.equal(isApprovedImageUrl("/Kani%20shawls/%2e%2e/secret.png"), false);
    assert.equal(isApprovedImageUrl("/Kani%5cshawls/photo.png"), false);
    assert.equal(isApprovedImageUrl("/images/not-a-catalogue-file.png"), false);
    const gallery = readFileSync("components/product-gallery.tsx", "utf8");
    assert.match(gallery, /preload=\{safeIndex === 0\}/);
    assert.match(gallery, /revealed\.has\(index\)/);
    assert.match(gallery, /quality=\{60\}/);
    assert.doesNotMatch(gallery, /formats:\s*\[.*avif/);
    const blank = planShawlImport({
      shawls: [{ ...shawl, images: [] }],
      categories,
      products: [],
      update: false,
    });
    assert.equal(blank[0]?.action, "skip");
    const many = {
      ...shawl,
      folderName: "1.20",
      images: Array.from({ length: MAX_PRODUCT_IMAGES + 1 }, (_, index) => ({
        name: `${index}.png`,
        relativePath: `${String(index).padStart(2, "0")}.png`,
        url: `/Kani shawls/1.20/${index}.png`,
      })),
    };
    const capped = planShawlImport({ shawls: [many], categories, products: [], update: false });
    assert.equal(capped[0]?.draft?.images.length, MAX_PRODUCT_IMAGES);
    assert.equal(capped[0]?.draft?.omittedImages.length, 1);
    const owned = {
      slug: "kani-1-18",
      sku: "KL-KANI-1-18",
      imageUrls: ["/Kani shawls/1.18/a.png"],
      status: "active",
      pricePaise: 900_000,
    };
    const incomplete = planShawlImport({ shawls: [shawl], categories, products: [owned], update: false });
    assert.equal(incomplete[0]?.action, "images-incomplete");
    assert.match(incomplete[0]?.reason ?? "", /active/);
    const repair = planShawlImport({ shawls: [shawl], categories, products: [owned], update: true });
    assert.equal(repair[0]?.action, "update");
    const patch = importerImagePatch(repair[0]?.draft ?? first[0]!.draft!);
    assert.deepEqual(Object.keys(patch), ["images"]);
    assert.equal(patch.images.length, 2);
    assert.equal(patch.images[0]?.primary, true);
    assert.equal(visibleGalleryImages(patch.images).length, 2);
    assert.equal(visibleGalleryImages(Array.from({ length: 8 }, (_, index) => index)).length, 8);
  });

  test("accounts for every source shawl folder without a duplicate on the next run", async () => {
    const shawls = await discoverShawls(`${process.cwd()}/public`);
    const categories = [
      { slug: "kalamkari", name: "kalamkari Shawls" },
      { slug: "kani", name: "Kani shawls" },
      { slug: "machine-embroidery", name: "Machine  Embroidery" },
      { slug: "sozni-shawls", name: "Sozni Shawls" },
      { slug: "zari-shawls", name: "Zari Shawls" },
    ];
    const plan = planShawlImport({ shawls, categories, products: [], update: false });
    const creates = plan.filter((row) => row.action === "create");
    assert.equal(creates.length, 30);
    assert.equal(plan.some((row) => row.action === "missing-category" || row.action === "skip"), false);
    assert.equal(creates.every((row) => row.draft?.status === "draft" && row.draft.pricePaise === 500_000), true);
    assert.equal(creates.every((row) => (row.draft?.omittedImages.length ?? 1) === 0), true);
    const widest = Math.max(...creates.map((row) => row.draft?.images.length ?? 0));
    assert.ok(widest > 6);
    assert.equal(visibleGalleryImages(creates.find((row) => (row.draft?.images.length ?? 0) === widest)?.draft?.images ?? []).length, widest);
    const repeat = planShawlImport({
      shawls,
      categories,
      products: creates.map((row) => ({
        slug: row.draft?.slug ?? "",
        sku: row.draft?.sku ?? "",
        imageUrls: row.draft?.images.map((image) => image.url),
        status: "draft" as const,
        pricePaise: row.draft?.pricePaise,
      })),
      update: true,
    });
    assert.equal(repeat.every((row) => row.action === "already-imported"), true);
  });
});
