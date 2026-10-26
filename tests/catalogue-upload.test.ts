import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { postCatalogueImage } from "@/lib/catalogue/browser-upload";
import { CATALOGUE_IMAGE_FOLDER, CATALOGUE_IMAGE_FORMATS } from "@/lib/catalogue/upload-grant";
import { catalogueUploadSignature } from "@/lib/cloudinary";

const secret = "catalogue-upload-test-secret";

function grant() {
  const timestamp = 1_700_000_000;
  return {
    cloudName: "demo-cloud",
    apiKey: "public-key",
    timestamp,
    folder: CATALOGUE_IMAGE_FOLDER,
    allowedFormats: CATALOGUE_IMAGE_FORMATS,
    signature: catalogueUploadSignature({
      folder: CATALOGUE_IMAGE_FOLDER,
      timestamp,
      allowedFormats: CATALOGUE_IMAGE_FORMATS,
      apiSecret: secret,
    }),
  };
}

describe("catalogue image upload", () => {
  test("signs the upload without putting the API secret in the browser payload", () => {
    const upload = grant();
    const expected = createHash("sha1")
      .update(`allowed_formats=${CATALOGUE_IMAGE_FORMATS}&folder=${CATALOGUE_IMAGE_FOLDER}&timestamp=1700000000${secret}`)
      .digest("hex");
    assert.equal(upload.signature, expected);
    assert.equal(Object.hasOwn(upload, "apiSecret"), false);
    assert.equal(JSON.stringify(upload).includes(secret), false);
  });

  test("posts the image to Cloudinary and returns only its secure URL", async () => {
    const upload = grant();
    const file = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0x00])], "shawl.jpg", { type: "image/jpeg" });
    let postedUrl = "";
    let postedFields: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      postedUrl = String(input);
      const body = init?.body;
      assert.ok(body instanceof FormData);
      postedFields = [...body.keys()];
      assert.equal(body.get("api_key"), upload.apiKey);
      assert.equal(body.get("signature"), upload.signature);
      assert.equal(body.get("api_secret"), null);
      return Response.json({
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/kashmiriloom/shawl.jpg",
      });
    };
    const result = await postCatalogueImage(file, upload, fetchImpl);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url, "https://res.cloudinary.com/demo-cloud/image/upload/v1/kashmiriloom/shawl.jpg");
    }
    assert.equal(postedUrl, "https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
    assert.deepEqual(postedFields.sort(), ["allowed_formats", "api_key", "file", "folder", "signature", "timestamp"]);
  });

  test("rejects an oversized file before any upload request", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return Response.json({});
    };
    const file = new File([new Uint8Array(4_000_001)], "large.jpg", { type: "image/jpeg" });
    const result = await postCatalogueImage(file, grant(), fetchImpl);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /4 MB/);
    }
    assert.equal(called, false);
  });

  test("category creation submits metadata, and the image file bypasses the server action", () => {
    const form = readFileSync("components/admin/category-form.tsx", "utf8");
    const action = readFileSync("app/admin/category-actions.ts", "utf8");
    const prepare = readFileSync("app/admin/actions.ts", "utf8");
    const config = readFileSync("next.config.ts", "utf8");
    assert.match(form, /uploadCatalogueImageFile/);
    assert.match(form, /name="imageUrl"/);
    assert.doesNotMatch(form, /data\.set\("file"/);
    assert.doesNotMatch(form, /uploadProductImage/);
    assert.match(form, /form="catalogue-file-upload"/);
    assert.match(action, /formData\.get\("imageUrl"\)/);
    assert.doesNotMatch(action, /formData\.get\("file"\)/);
    assert.match(prepare, /function prepareCatalogueImageUpload/);
    assert.doesNotMatch(prepare, /formData\.get\("file"\)/);
    assert.doesNotMatch(config, /bodySizeLimit/);
  });
});
