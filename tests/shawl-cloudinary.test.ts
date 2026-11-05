import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { cloudinaryTransformedUrl, shawlDeliveryUrl, shawlPublicId } from "@/lib/catalogue/cloudinary-delivery";
import { cloudinaryInfoUrl } from "@/lib/catalogue/cloudinary-delivery";
import { sizeFromCloudinaryInfo, sizeFromImageBytes } from "@/lib/catalogue/image-dimensions";
import { frameObjectFit } from "@/lib/catalogue/image-frame";
import { cloudinaryUploadSignature } from "@/lib/catalogue/cloudinary-sign";
import { summarizeCloudinaryUsage } from "@/lib/catalogue/cloudinary-usage";
import { cloudinaryImagePatch, planShawlCloudinaryMigration, type CloudinaryProduct } from "@/lib/catalogue/shawl-cloudinary";
import { isApprovedImageUrl } from "@/lib/products/images";

const cloud = "demo-cloud";

function product(slug: string, sku: string, images: CloudinaryProduct["images"], name = slug): CloudinaryProduct {
  return { name, slug, sku, images };
}

describe("imported shawl Cloudinary migration", () => {
  test("accepts this house's Cloudinary upload and rejects another host or a traversal path", () => {
    const previous = process.env.CLOUDINARY_CLOUD_NAME;
    process.env.CLOUDINARY_CLOUD_NAME = cloud;
    try {
      const stored = shawlDeliveryUrl(cloud, "kani-1-18", 0);
      assert.equal(isApprovedImageUrl(stored), true);
      assert.equal(isApprovedImageUrl("https://res.cloudinary.com/other-cloud/image/upload/kashmiriloom/shawls/kani-1-18/01"), false);
      assert.equal(isApprovedImageUrl("https://files.example/image/upload/kashmiriloom/shawls/kani-1-18/01"), false);
      assert.equal(isApprovedImageUrl(`https://res.cloudinary.com/${cloud}/image/upload/../secret`), false);
      assert.equal(isApprovedImageUrl("/Kani shawls/1.18/photo.png"), true);
    } finally {
      if (previous === undefined) {
        delete process.env.CLOUDINARY_CLOUD_NAME;
      } else {
        process.env.CLOUDINARY_CLOUD_NAME = previous;
      }
    }
  });

  test("requests a small transformed width for a card and a larger width for a gallery", () => {
    const stored = shawlDeliveryUrl(cloud, "kani-1-18", 0);
    const card = cloudinaryTransformedUrl(stored, 640);
    const gallery = cloudinaryTransformedUrl(stored, 1600);
    assert.equal(card, `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto:good,c_limit,w_640/kashmiriloom/shawls/kani-1-18/01`);
    assert.equal(gallery, `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto:good,c_limit,w_1600/kashmiriloom/shawls/kani-1-18/01`);
    assert.equal(cloudinaryTransformedUrl("https://evil.example/photo.png", 640), null);
    assert.equal(cloudinaryTransformedUrl(stored, 0), null);
    assert.doesNotMatch(`${card} ${gallery}`, /c_fill|c_crop|c_pad/);
  });

  test("reuses the same public id and leaves an unrelated product out of the update", () => {
    const local = "/Kani shawls/1.18/photo.png";
    const identities = [{ source: "Kani shawls", folderName: "1.18", slug: "kani-1-18", sku: "KL-KANI-1-18" }];
    const files = new Map([["Kani shawls/1.18/photo.png", 1200]]);
    const first = planShawlCloudinaryMigration({
      identities,
      products: [
        product("kani-1-18", "KL-KANI-1-18", [{ url: local, alt: "First photograph", primary: true }]),
        product("nishat", "KL-SAMPLE-NISHAT", [{ url: "/images/shawl-nishat.jpg", alt: "Sample", primary: true }]),
      ],
      cloudName: cloud,
      fileBytes: files,
      expectedCount: 1,
    });
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    const again = planShawlCloudinaryMigration({
      identities,
      products: [
        product("kani-1-18", "KL-KANI-1-18", [{ url: local, alt: "First photograph", primary: true }]),
        product("nishat", "KL-SAMPLE-NISHAT", [{ url: "/images/shawl-nishat.jpg", alt: "Sample", primary: true }]),
      ],
      cloudName: cloud,
      fileBytes: files,
      expectedCount: 1,
    });
    assert.equal(again.ok, true);
    if (!again.ok) {
      return;
    }
    assert.equal(first.rows.length, 1);
    assert.equal(again.rows[0]?.images[0]?.publicId, shawlPublicId("kani-1-18", 0));
    assert.equal(first.rows[0]?.images[0]?.publicId, again.rows[0]?.images[0]?.publicId);
    assert.equal(first.rows.some((row) => row.slug === "nishat"), false);
    const patch = cloudinaryImagePatch(first.rows[0]!);
    assert.deepEqual(Object.keys(patch ?? {}), ["images"]);
    assert.equal(patch?.images[0]?.alt, "First photograph");
    assert.equal(patch?.images[0]?.primary, true);
    assert.equal(patch?.images[0]?.url, shawlDeliveryUrl(cloud, "kani-1-18", 0));
  });

  test("treats a completed gallery as already migrated and blocks a partial or conflicting product", () => {
    const done = shawlDeliveryUrl(cloud, "kani-1-18", 0);
    const second = shawlDeliveryUrl(cloud, "kani-1-18", 1);
    const migrated = planShawlCloudinaryMigration({
      identities: [{ source: "Kani shawls", folderName: "1.18", slug: "kani-1-18", sku: "KL-KANI-1-18" }],
      products: [
        product("kani-1-18", "KL-KANI-1-18", [
          { url: done, alt: "One", primary: true },
          { url: second, alt: "Two" },
        ]),
      ],
      cloudName: cloud,
      fileBytes: new Map(),
      expectedCount: 1,
    });
    assert.equal(migrated.ok, true);
    if (!migrated.ok) {
      return;
    }
    assert.equal(migrated.rows[0]?.action, "already-migrated");
    assert.equal(cloudinaryImagePatch(migrated.rows[0]!), null);

    const conflict = planShawlCloudinaryMigration({
      identities: [{ source: "Kani shawls", folderName: "1.18", slug: "kani-1-18", sku: "KL-KANI-1-18" }],
      products: [
        product("kani-1-18", "KL-OTHER", [{ url: "/Kani shawls/1.18/photo.png", alt: "Other", primary: true }]),
        product("nishat", "KL-SAMPLE-NISHAT", [{ url: "/images/shawl-nishat.jpg", alt: "Sample", primary: true }]),
      ],
      cloudName: cloud,
      fileBytes: new Map([["Kani shawls/1.18/photo.png", 10]]),
      expectedCount: 1,
    });
    assert.equal(conflict.ok, false);

    const missing = planShawlCloudinaryMigration({
      identities: [{ source: "Kani shawls", folderName: "1.18", slug: "kani-1-18", sku: "KL-KANI-1-18" }],
      products: [product("kani-1-18", "KL-KANI-1-18", [{ url: "/Kani shawls/1.18/missing.png", alt: "Missing", primary: true }])],
      cloudName: cloud,
      fileBytes: new Map(),
      expectedCount: 1,
    });
    assert.equal(missing.ok, true);
    if (!missing.ok) {
      return;
    }
    assert.equal(missing.rows[0]?.action, "blocked");
    assert.equal(cloudinaryImagePatch(missing.rows[0]!), null);
  });

  test("signs upload parameters in order and keeps the apply write limited to image URLs", () => {
    const secret = "test-secret";
    const signature = cloudinaryUploadSignature(
      { timestamp: "1", public_id: "kashmiriloom/shawls/kani-1-18/01", overwrite: "true" },
      secret,
    );
    const expected = createHash("sha1")
      .update("overwrite=true&public_id=kashmiriloom/shawls/kani-1-18/01&timestamp=1test-secret")
      .digest("hex");
    assert.equal(signature, expected);
    const script = readFileSync("scripts/migrate-shawl-images.ts", "utf8");
    assert.match(script, /\$set:\s*\{\s*images:\s*patch\.images\s*\}/);
    assert.match(script, /slug:\s*row\.slug,\s*sku:\s*row\.sku/);
    assert.doesNotMatch(script, /unlink|rmSync|rename\(/);
    assert.equal(summarizeCloudinaryUsage({ plan: "Free", storage: { usage: 10, limit: 20 }, credits: { usage: 1, limit: 25 } })?.storageUsed, 10);
    assert.equal(summarizeCloudinaryUsage({ api_secret: "hidden" })?.plan, null);
  });

  test("keeps a tall shawl whole and lets a wide textile photo fill its frame", () => {
    assert.equal(frameObjectFit(432, 934, 384, 512), "contain");
    assert.equal(frameObjectFit(432, 324, 384, 512), "cover");
    assert.equal(frameObjectFit(3, 4, 300, 400), "cover");
    assert.equal(frameObjectFit(0, 10, 10, 10), "contain");
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x03, 0x55, 0, 0, 0x07, 0x34]);
    assert.deepEqual(sizeFromImageBytes(png), { width: 853, height: 1844 });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xb4, 0x02, 0x00, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
    assert.deepEqual(sizeFromImageBytes(jpeg), { width: 512, height: 436 });
    assert.deepEqual(sizeFromCloudinaryInfo({ input: { width: 432, height: 432 } }), { width: 432, height: 432 });
    assert.equal(sizeFromCloudinaryInfo({ output: { width: 10, height: 10 } }), null);
    const info = cloudinaryInfoUrl("https://res.cloudinary.com/demo/image/upload/kashmiriloom/shawls/nishat/01");
    assert.equal(info, "https://res.cloudinary.com/demo/image/upload/fl_getinfo/kashmiriloom/shawls/nishat/01");
    assert.equal(info?.includes("c_fill") ?? false, false);
    assert.equal(cloudinaryInfoUrl("https://res.cloudinary.com/demo/image/upload/../secret"), null);
    const collection = readFileSync("components/collection-grid.tsx", "utf8");
    const card = readFileSync("components/product-card.tsx", "utf8");
    const gallery = readFileSync("components/product-gallery.tsx", "utf8");
    const category = readFileSync("app/(store)/collections/[slug]/page.tsx", "utf8");
    const frame = readFileSync("components/photo-frame.tsx", "utf8");
    for (const source of [collection, card, category]) {
      assert.match(source, /PhotoFrame/);
      assert.match(source, /imageWidth/);
      assert.doesNotMatch(source, /aspect-\[(?:3\/4|4\/3|7\/15)\]/);
      assert.doesNotMatch(source, /object-cover|scale-/);
    }
    assert.match(card, /flex h-full flex-col/);
    assert.match(collection, /flex h-full flex-col/);
    assert.match(readFileSync("lib/catalogue/measure-image.ts", "utf8"), /function photoSizeFor/);
    assert.match(frame, /3 \/ 4/);
    assert.match(gallery, /PhotoFrame/);
    assert.match(gallery, /preload=\{safeIndex === 0\}/);
    assert.doesNotMatch(gallery, /aspect-\[3\/4\]|aspect-\[7\/15\]|object-cover/);
    assert.match(frame, /aspectRatio/);
    assert.match(frame, /object-contain/);
    assert.match(readFileSync("components/catalogue-image.tsx", "utf8"), /frameObjectFit/);
    assert.match(readFileSync("components/bag-panel.tsx", "utf8"), /object-contain/);
    assert.doesNotMatch(readFileSync("components/featured-shawls.tsx", "utf8"), /col-span-2|aspect-\[16\/10\]/);
  });
});
