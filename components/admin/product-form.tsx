"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadCatalogueImageFile } from "@/components/admin/direct-upload";
import { FormFeedback } from "@/components/admin/form-feedback";
import type { ProductFormState } from "@/app/admin/actions";
import type { ProductStatus } from "@/lib/products/status";

type ImageRow = { key: string; url: string; alt: string; primary: boolean };

export type CategoryOption = { slug: string; name: string; active: boolean };

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  collectionSlugs: string[];
  priceRupees: string;
  compareAtRupees: string;
  sku: string;
  stockQuantity: string;
  status: ProductStatus;
  featured: boolean;
  images: { url: string; alt: string; primary: boolean }[];
  material: string;
  dimensions: string;
  care: string;
  color: string;
  weave: string;
  embroidery: string;
  size: string;
  variantGroup: string;
  variantLabel: string;
  expectedUpdatedAt: string;
  linkSourceId: string;
};

const emptyState: ProductFormState = { message: "", errors: {}, attempt: 0 };

const fieldClass =
  "mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest";

function SubmitButton({ label, busy }: { label: string; busy: boolean }) {
  const { pending } = useFormStatus();
  const waiting = pending || busy;
  return (
    <button
      type="submit"
      disabled={waiting}
      aria-busy={pending}
      className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
    >
      {pending ? "Saving..." : label}
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

function TextField({
  id,
  name,
  label,
  defaultValue,
  error,
  maxLength,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  maxLength: number;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-forest">
        {label}
      </label>
      <input id={id} name={name} defaultValue={defaultValue} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={fieldClass} />
      {hint ? <p className="mt-2 text-sm text-muted">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function ProductForm({
  productId,
  action,
  values,
  categories,
  localImages,
  cloudinaryReady,
  notice,
}: {
  productId: string;
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  values: ProductFormValues;
  categories: CategoryOption[];
  localImages: string[];
  cloudinaryReady: boolean;
  notice: string;
}) {
  const formId = useId();
  const uploadRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction] = useActionState(action, emptyState);
  const [dismissNotice, setDismissNotice] = useState(false);
  const fields = state.entered ?? values;
  const [category, setCategory] = useState(values.category);
  const [images, setImages] = useState<ImageRow[]>(() => {
    const rows =
      values.images.length > 0
        ? values.images.map((image, index) => ({ ...image, key: `${index}-${image.url}` }))
        : [{ key: "first", url: localImages[0] ?? "", alt: "", primary: true }];
    return rows.some((row) => row.primary) ? rows : rows.map((row, index) => ({ ...row, primary: index === 0 }));
  });
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (uploadMessage) {
      uploadRef.current?.focus();
    }
  }, [uploadMessage]);
  const choices = categories.some((item) => item.slug === category)
    ? categories
    : [{ slug: category, name: category, active: false }, ...categories];

  function updateImage(key: string, patch: Partial<ImageRow>) {
    setImages((current) => current.map((image) => (image.key === key ? { ...image, ...patch } : image)));
  }

  function makePrimary(key: string) {
    setImages((current) => current.map((image) => ({ ...image, primary: image.key === key })));
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
      if (!row) {
        return current;
      }
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
    const result = await uploadCatalogueImageFile(file);
    setUploading(false);
    if (!result.url) {
      setUploadMessage(result.message);
      return;
    }
    setImages((current) =>
      current.length >= 6
        ? current
        : [...current, { key: result.url, url: result.url, alt: "", primary: current.length === 0 }],
    );
  }

  return (
    <form key={state.attempt} action={formAction} onSubmit={() => { setDismissNotice(true); setUploadMessage(""); }} className="mt-8 space-y-6">
      <input type="hidden" name="expectedUpdatedAt" value={fields.expectedUpdatedAt} />
      <input type="hidden" name="linkSourceId" value={fields.linkSourceId} />
      <FormFeedback notice={dismissNotice ? "" : notice} error={state.message} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-name`} className="text-sm font-medium text-forest">
            Name
          </label>
          <input id={`${formId}-name`} name="name" defaultValue={fields.name} required maxLength={120} className={fieldClass} aria-invalid={Boolean(state.errors.name)} aria-describedby={state.errors.name ? `${formId}-name-error` : undefined} />
          <FieldError id={`${formId}-name-error`} message={state.errors.name} />
        </div>
        <div>
          <label htmlFor={`${formId}-slug`} className="text-sm font-medium text-forest">
            Slug
          </label>
          <input id={`${formId}-slug`} name="slug" defaultValue={fields.slug} required maxLength={80} className={fieldClass} aria-invalid={Boolean(state.errors.slug)} aria-describedby={state.errors.slug ? `${formId}-slug-error` : `${formId}-slug-help`} />
          <p id={`${formId}-slug-help`} className="mt-2 text-sm text-muted">
            The public address uses this slug. The previous address keeps working for an active shawl.
          </p>
          <FieldError id={`${formId}-slug-error`} message={state.errors.slug} />
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-short`} className="text-sm font-medium text-forest">
          Short description
        </label>
        <textarea id={`${formId}-short`} name="shortDescription" defaultValue={fields.shortDescription} maxLength={280} rows={2} aria-invalid={Boolean(state.errors.shortDescription)} aria-describedby={state.errors.shortDescription ? `${formId}-short-error` : undefined} className={fieldClass} />
        <p className="mt-2 text-sm text-muted">Shown on product cards. Leave blank to use the first sentence of the description.</p>
        <FieldError id={`${formId}-short-error`} message={state.errors.shortDescription} />
      </div>
      <div>
        <label htmlFor={`${formId}-description`} className="text-sm font-medium text-forest">
          Description
        </label>
        <textarea id={`${formId}-description`} name="description" defaultValue={fields.description} required maxLength={2000} rows={6} aria-invalid={Boolean(state.errors.description)} aria-describedby={state.errors.description ? `${formId}-description-error` : undefined} className={fieldClass} />
        <FieldError id={`${formId}-description-error`} message={state.errors.description} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-category`} className="text-sm font-medium text-forest">
            Category
          </label>
          <select
            id={`${formId}-category`}
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={fieldClass}
          >
            {choices.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
                {item.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          <FieldError id={`${formId}-category-error`} message={state.errors.category} />
        </div>
        <div>
          <label htmlFor={`${formId}-sku`} className="text-sm font-medium text-forest">
            SKU
          </label>
          <input id={`${formId}-sku`} name="sku" defaultValue={fields.sku} required maxLength={40} aria-invalid={Boolean(state.errors.sku)} aria-describedby={state.errors.sku ? `${formId}-sku-error` : undefined} className={fieldClass} />
          <p className="mt-2 text-sm text-muted">Each stocked shawl or option needs its own SKU.</p>
          <FieldError id={`${formId}-sku-error`} message={state.errors.sku} />
        </div>
        <div>
          <label htmlFor={`${formId}-price`} className="text-sm font-medium text-forest">
            Price (INR)
          </label>
          <input id={`${formId}-price`} name="priceRupees" inputMode="decimal" defaultValue={fields.priceRupees} required aria-invalid={Boolean(state.errors.priceRupees)} aria-describedby={state.errors.priceRupees ? `${formId}-price-error` : undefined} className={fieldClass} />
          <FieldError id={`${formId}-price-error`} message={state.errors.priceRupees} />
        </div>
        <div>
          <label htmlFor={`${formId}-compare`} className="text-sm font-medium text-forest">
            Compare-at price (INR)
          </label>
          <input id={`${formId}-compare`} name="compareAtRupees" inputMode="decimal" defaultValue={fields.compareAtRupees} aria-invalid={Boolean(state.errors.compareAtRupees)} aria-describedby={state.errors.compareAtRupees ? `${formId}-compare-error` : undefined} className={fieldClass} />
          <p className="mt-2 text-sm text-muted">Leave blank when there is no higher previous price.</p>
          <FieldError id={`${formId}-compare-error`} message={state.errors.compareAtRupees} />
        </div>
        <div>
          <label htmlFor={`${formId}-stock`} className="text-sm font-medium text-forest">
            Catalogue quantity
          </label>
          <input id={`${formId}-stock`} name="stockQuantity" inputMode="numeric" defaultValue={fields.stockQuantity} required aria-invalid={Boolean(state.errors.stockQuantity)} aria-describedby={state.errors.stockQuantity ? `${formId}-stock-error` : undefined} className={fieldClass} />
          <p className="mt-2 text-sm text-muted">
            This quantity belongs to this SKU. A quantity of {3} or below is marked low in the admin list.
          </p>
          <FieldError id={`${formId}-stock-error`} message={state.errors.stockQuantity} />
        </div>
        <div>
          <label htmlFor={`${formId}-status`} className="text-sm font-medium text-forest">
            Status
          </label>
          <select id={`${formId}-status`} name="status" defaultValue={fields.status} aria-invalid={Boolean(state.errors.status)} aria-describedby={state.errors.status ? `${formId}-status-error` : undefined} className={fieldClass}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <p className="mt-2 text-sm text-muted">Only an active shawl appears in the shop and can be reserved.</p>
          <FieldError id={`${formId}-status-error`} message={state.errors.status} />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-forest">Also show in these collections</legend>
        <p className="mt-2 text-sm text-muted">Optional. The category above is already included.</p>
        <div className="mt-3 flex flex-col gap-2">
          {choices
            .filter((item) => item.slug !== category)
            .map((item) => (
              <label key={item.slug} className="inline-flex min-h-11 items-center gap-3 text-sm text-forest">
                <input
                  type="checkbox"
                  name="collectionSlug"
                  value={item.slug}
                  defaultChecked={fields.collectionSlugs.includes(item.slug)}
                  className="size-4 accent-burgundy"
                />
                {item.name}
                {item.active ? "" : " (inactive)"}
              </label>
            ))}
        </div>
        <FieldError id={`${formId}-collections-error`} message={state.errors.collectionSlugs} />
      </fieldset>

      <fieldset className="flex flex-wrap gap-6">
        <legend className="sr-only">Featured</legend>
        <label className="inline-flex min-h-12 items-center gap-3 text-sm text-forest">
          <input type="checkbox" name="featured" defaultChecked={fields.featured} className="size-4 accent-burgundy" />
          Featured while active
        </label>
      </fieldset>

      <fieldset className="grid gap-6 sm:grid-cols-2">
        <legend className="text-sm font-medium text-forest sm:col-span-2">Options for this stocked shawl</legend>
        <TextField id={`${formId}-variant-group`} name="variantGroup" label="Variant group" defaultValue={fields.variantGroup} error={state.errors.variantGroup} maxLength={80} hint="Leave blank for a shawl with one stock record. Use the same group for other colours or sizes, each with its own SKU." />
        <TextField id={`${formId}-variant-label`} name="variantLabel" label="Option label" defaultValue={fields.variantLabel} error={state.errors.variantLabel} maxLength={80} hint="For example, ivory or large." />
        <TextField id={`${formId}-color`} name="color" label="Colour" defaultValue={fields.color} error={state.errors.color} maxLength={80} />
        <TextField id={`${formId}-size`} name="size" label="Size" defaultValue={fields.size} error={state.errors.size} maxLength={80} />
        <TextField id={`${formId}-weave`} name="weave" label="Weave" defaultValue={fields.weave} error={state.errors.weave} maxLength={80} />
        <TextField id={`${formId}-embroidery`} name="embroidery" label="Embroidery" defaultValue={fields.embroidery} error={state.errors.embroidery} maxLength={80} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-forest">Images</legend>
        <p className="text-sm text-muted">Order the photographs, and choose one primary image for cards.</p>
        {state.errors.images ? <p id={`${formId}-images-error`} role="alert" className="text-sm text-burgundy">{state.errors.images}</p> : null}
        {images.map((image, index) => (
          <div key={image.key} className="border border-gold/70 p-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Image {index + 1}</p>
            <input type="hidden" name="imageUrl" value={image.url} />
            <p className="mt-3 break-all text-sm text-muted">{image.url || "No image selected"}</p>
            <label className="mt-3 inline-flex min-h-11 items-center gap-3 text-sm text-forest">
              <input type="radio" name="primaryImage" value={String(index)} checked={image.primary} onChange={() => makePrimary(image.key)} className="size-4 accent-burgundy" />
              Primary image
            </label>
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
                onClick={() =>
                  setImages((current) => {
                    const next = current.filter((row) => row.key !== image.key);
                    const first = next[0];
                    if (first && !next.some((row) => row.primary)) {
                      next[0] = { ...first, primary: true };
                    }
                    return next;
                  })
                }
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
            setImages((current) => [...current, { key: `${url}-${current.length}`, url, alt: "", primary: current.length === 0 }]);
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
              form="catalogue-file-upload"
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
            Cloudinary is not configured, so new files cannot be uploaded. Choose one of the existing photographs, or add the Cloudinary server variables and restart.
          </p>
        )}
        {uploadMessage ? <p ref={uploadRef} tabIndex={-1} role="alert" className="text-sm text-burgundy outline-none">{uploadMessage}</p> : null}
        {uploading ? <p className="text-sm text-muted">Uploading…</p> : null}
      </fieldset>

      <div className="grid gap-6">
        <TextField id={`${formId}-material`} name="material" label="Material" defaultValue={fields.material} error={state.errors.material} maxLength={200} hint="Leave blank when the material is not recorded." />
        <TextField id={`${formId}-dimensions`} name="dimensions" label="Dimensions" defaultValue={fields.dimensions} error={state.errors.dimensions} maxLength={200} />
        <div>
          <label htmlFor={`${formId}-care`} className="text-sm font-medium text-forest">
            Care
          </label>
          <textarea id={`${formId}-care`} name="care" defaultValue={fields.care} maxLength={500} rows={3} aria-invalid={Boolean(state.errors.care)} aria-describedby={state.errors.care ? `${formId}-care-error` : undefined} className={fieldClass} />
          <FieldError id={`${formId}-care-error`} message={state.errors.care} />
        </div>
      </div>

      <SubmitButton label={productId ? "Save shawl" : "Create shawl"} busy={uploading} />
    </form>
  );
}
