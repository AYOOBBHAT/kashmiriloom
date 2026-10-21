"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadProductImage, type ProductFormState } from "@/app/admin/actions";
import { collectionLabels, type CollectionId } from "@/data/catalog";

type ImageRow = { key: string; url: string; alt: string };

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  category: CollectionId;
  priceRupees: string;
  compareAtRupees: string;
  sku: string;
  stockQuantity: string;
  active: boolean;
  featured: boolean;
  images: { url: string; alt: string }[];
  material: string;
  dimensions: string;
  care: string;
};

const emptyState: ProductFormState = { message: "", errors: {} };

const fieldClass =
  "mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-2 text-sm text-burgundy">
      {message}
    </p>
  );
}

export function ProductForm({
  productId,
  action,
  values,
  localImages,
  cloudinaryReady,
  saved,
}: {
  productId: string;
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  values: ProductFormValues;
  localImages: string[];
  cloudinaryReady: boolean;
  saved: boolean;
}) {
  const formId = useId();
  const [state, formAction] = useActionState(action, emptyState);
  const [images, setImages] = useState<ImageRow[]>(
    values.images.length > 0
      ? values.images.map((image, index) => ({ ...image, key: `${index}-${image.url}` }))
      : [{ key: "first", url: localImages[0] ?? "", alt: "" }],
  );
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  function updateImage(key: string, patch: Partial<ImageRow>) {
    setImages((current) => current.map((image) => (image.key === key ? { ...image, ...patch } : image)));
  }

  function move(key: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.key === key);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) {
        return current;
      }
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(next, 0, row);
      return copy;
    });
  }

  async function onUpload(file: File | undefined) {
    if (!file) {
      return;
    }
    if (images.length >= 6) {
      setUploadMessage("Six images is the maximum.");
      return;
    }
    setUploading(true);
    setUploadMessage("");
    const data = new FormData();
    data.set("file", file);
    const result = await uploadProductImage({ message: "", url: "" }, data);
    setUploading(false);
    if (!result.url) {
      setUploadMessage(result.message);
      return;
    }
    setImages((current) =>
      current.length >= 6 ? current : [...current, { key: result.url, url: result.url, alt: "" }],
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {saved && !state.message ? (
        <p className="border border-gold bg-ivory px-4 py-3 text-sm text-forest" role="status">
          Saved.
        </p>
      ) : null}
      {state.message ? (
        <p className="border border-burgundy/40 bg-ivory px-4 py-3 text-sm text-burgundy" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-name`} className="text-sm font-medium text-forest">
            Name
          </label>
          <input id={`${formId}-name`} name="name" defaultValue={values.name} required maxLength={120} className={fieldClass} aria-invalid={Boolean(state.errors.name)} aria-describedby={state.errors.name ? `${formId}-name-error` : undefined} />
          <FieldError id={`${formId}-name-error`} message={state.errors.name} />
        </div>
        <div>
          <label htmlFor={`${formId}-slug`} className="text-sm font-medium text-forest">
            Slug
          </label>
          <input id={`${formId}-slug`} name="slug" defaultValue={values.slug} required maxLength={80} className={fieldClass} aria-invalid={Boolean(state.errors.slug)} aria-describedby={`${formId}-slug-help`} />
          <p id={`${formId}-slug-help`} className="mt-2 text-sm text-muted">
            The public address uses this slug. Changing it changes that address and existing bag lines.
          </p>
          <FieldError id={`${formId}-slug-error`} message={state.errors.slug} />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-description`} className="text-sm font-medium text-forest">
          Description
        </label>
        <textarea id={`${formId}-description`} name="description" defaultValue={values.description} required maxLength={2000} rows={6} className={fieldClass} />
        <FieldError id={`${formId}-description-error`} message={state.errors.description} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-category`} className="text-sm font-medium text-forest">
            Category
          </label>
          <select id={`${formId}-category`} name="category" defaultValue={values.category} className={fieldClass}>
            {(Object.keys(collectionLabels) as CollectionId[]).map((category) => (
              <option key={category} value={category}>
                {collectionLabels[category]}
              </option>
            ))}
          </select>
          <FieldError id={`${formId}-category-error`} message={state.errors.category} />
        </div>
        <div>
          <label htmlFor={`${formId}-sku`} className="text-sm font-medium text-forest">
            SKU
          </label>
          <input id={`${formId}-sku`} name="sku" defaultValue={values.sku} required maxLength={40} className={fieldClass} />
          <FieldError id={`${formId}-sku-error`} message={state.errors.sku} />
        </div>
        <div>
          <label htmlFor={`${formId}-price`} className="text-sm font-medium text-forest">
            Price (INR)
          </label>
          <input id={`${formId}-price`} name="priceRupees" inputMode="decimal" defaultValue={values.priceRupees} required className={fieldClass} />
          <FieldError id={`${formId}-price-error`} message={state.errors.priceRupees} />
        </div>
        <div>
          <label htmlFor={`${formId}-compare`} className="text-sm font-medium text-forest">
            Compare-at price (INR)
          </label>
          <input id={`${formId}-compare`} name="compareAtRupees" inputMode="decimal" defaultValue={values.compareAtRupees} className={fieldClass} />
          <p className="mt-2 text-sm text-muted">Leave blank when there is no higher previous price.</p>
          <FieldError id={`${formId}-compare-error`} message={state.errors.compareAtRupees} />
        </div>
        <div>
          <label htmlFor={`${formId}-stock`} className="text-sm font-medium text-forest">
            Catalogue quantity
          </label>
          <input id={`${formId}-stock`} name="stockQuantity" inputMode="numeric" defaultValue={values.stockQuantity} required className={fieldClass} />
          <p className="mt-2 text-sm text-muted">
            This is the quantity stored on the catalogue record. Sample stock is not a verified warehouse count.
          </p>
          <FieldError id={`${formId}-stock-error`} message={state.errors.stockQuantity} />
        </div>
      </div>

      <fieldset className="flex flex-wrap gap-6">
        <legend className="sr-only">Visibility</legend>
        <label className="inline-flex min-h-12 items-center gap-3 text-sm text-forest">
          <input type="checkbox" name="active" defaultChecked={values.active} className="size-4 accent-burgundy" />
          Active on the shop
        </label>
        <label className="inline-flex min-h-12 items-center gap-3 text-sm text-forest">
          <input type="checkbox" name="featured" defaultChecked={values.featured} className="size-4 accent-burgundy" />
          Featured
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-forest">Images</legend>
        {state.errors.images ? <p className="text-sm text-burgundy">{state.errors.images}</p> : null}
        {images.map((image, index) => (
          <div key={image.key} className="border border-gold/70 p-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
              Image {index + 1}
            </p>
            <input type="hidden" name="imageUrl" value={image.url} />
            <p className="mt-3 break-all text-sm text-muted">{image.url || "No image selected"}</p>
            <label htmlFor={`${formId}-alt-${image.key}`} className="mt-3 block text-sm font-medium text-forest">
              Alternative text
            </label>
            <input
              id={`${formId}-alt-${image.key}`}
              name="imageAlt"
              value={image.alt}
              maxLength={300}
              onChange={(event) => updateImage(image.key, { alt: event.target.value })}
              className={fieldClass}
            />
            <FieldError id={`${formId}-alt-${image.key}-error`} message={state.errors[`image-${index}-alt`] ?? state.errors[`image-${index}-url`]} />
            <div className="mt-3 flex flex-wrap gap-4">
              <button type="button" onClick={() => move(image.key, -1)} className="min-h-12 text-sm text-forest underline decoration-gold underline-offset-4">
                Move earlier
              </button>
              <button type="button" onClick={() => move(image.key, 1)} className="min-h-12 text-sm text-forest underline decoration-gold underline-offset-4">
                Move later
              </button>
              <button
                type="button"
                onClick={() => setImages((current) => current.filter((row) => row.key !== image.key))}
                className="min-h-12 text-sm text-burgundy underline decoration-gold underline-offset-4"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <label htmlFor={`${formId}-existing`} className="block text-sm font-medium text-forest">
          Add an existing photograph
        </label>
        <select
          id={`${formId}-existing`}
          defaultValue=""
          onChange={(event) => {
            const url = event.target.value;
            event.target.value = "";
            if (!url || images.length >= 6) {
              return;
            }
            setImages((current) => [...current, { key: `${url}-${current.length}`, url, alt: "" }]);
          }}
          className={fieldClass}
        >
          <option value="">Choose a photograph</option>
          {localImages.map((url) => (
            <option key={url} value={url}>
              {url}
            </option>
          ))}
        </select>
        {cloudinaryReady ? (
          <div>
            <label htmlFor={`${formId}-upload`} className="block text-sm font-medium text-forest">
              Upload a photograph
            </label>
            <input
              id={`${formId}-upload`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || images.length >= 6}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onUpload(file);
              }}
              className="mt-2 block w-full text-sm text-ink"
            />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            Cloudinary is not configured, so new files cannot be uploaded. Choose one of the existing photographs, or add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server and restart.
          </p>
        )}
        {uploadMessage ? <p className="text-sm text-burgundy">{uploadMessage}</p> : null}
        {uploading ? <p className="text-sm text-muted">Uploading…</p> : null}
      </fieldset>

      <div className="grid gap-6">
        <div>
          <label htmlFor={`${formId}-material`} className="text-sm font-medium text-forest">
            Material
          </label>
          <input id={`${formId}-material`} name="material" defaultValue={values.material} maxLength={200} className={fieldClass} />
          <p className="mt-2 text-sm text-muted">Leave blank when the material is not recorded.</p>
          <FieldError id={`${formId}-material-error`} message={state.errors.material} />
        </div>
        <div>
          <label htmlFor={`${formId}-dimensions`} className="text-sm font-medium text-forest">
            Dimensions
          </label>
          <input id={`${formId}-dimensions`} name="dimensions" defaultValue={values.dimensions} maxLength={200} className={fieldClass} />
          <FieldError id={`${formId}-dimensions-error`} message={state.errors.dimensions} />
        </div>
        <div>
          <label htmlFor={`${formId}-care`} className="text-sm font-medium text-forest">
            Care
          </label>
          <textarea id={`${formId}-care`} name="care" defaultValue={values.care} maxLength={500} rows={3} className={fieldClass} />
          <FieldError id={`${formId}-care-error`} message={state.errors.care} />
        </div>
      </div>

      <SubmitButton label={productId ? "Save shawl" : "Create shawl"} />
    </form>
  );
}
