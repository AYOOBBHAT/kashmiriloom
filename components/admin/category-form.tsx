"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadProductImage, type UploadState } from "@/app/admin/actions";
import type { CategoryFormState } from "@/app/admin/category-actions";

const fieldClass =
  "mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest";

const emptyState: CategoryFormState = { message: "", errors: {} };

export type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  active: boolean;
  displayOrder: string;
  expectedUpdatedAt: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60">
      {pending ? "Saving…" : label}
    </button>
  );
}

export function CategoryForm({
  categoryId,
  action,
  values,
  localImages,
  cloudinaryReady,
  notice,
}: {
  categoryId: string;
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  values: CategoryFormValues;
  localImages: string[];
  cloudinaryReady: boolean;
  notice: string;
}) {
  const formId = useId();
  const [state, formAction] = useActionState(action, emptyState);
  const [imageUrl, setImageUrl] = useState(values.imageUrl);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File | undefined) {
    if (!file) {
      return;
    }
    setUploading(true);
    setUploadMessage("");
    const data = new FormData();
    data.set("file", file);
    const result: UploadState = await uploadProductImage({ message: "", url: "" }, data);
    setUploading(false);
    if (!result.url) {
      setUploadMessage(result.message);
      return;
    }
    setImageUrl(result.url);
  }

  return (
    <form action={formAction} className="mt-8 max-w-2xl space-y-6">
      <input type="hidden" name="expectedUpdatedAt" value={values.expectedUpdatedAt} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      {notice && !state.message ? <p className="border border-gold px-4 py-3 text-sm text-forest" role="status">{notice}</p> : null}
      {state.message ? <p className="border border-burgundy/40 px-4 py-3 text-sm text-burgundy" role="alert">{state.message}</p> : null}
      <div>
        <label htmlFor={`${formId}-name`} className="text-sm font-medium text-forest">Name</label>
        <input id={`${formId}-name`} name="name" defaultValue={values.name} required maxLength={80} className={fieldClass} />
        {state.errors.name ? <p className="mt-2 text-sm text-burgundy">{state.errors.name}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-slug`} className="text-sm font-medium text-forest">Slug</label>
        <input id={`${formId}-slug`} name="slug" defaultValue={values.slug} required maxLength={80} className={fieldClass} />
        <p className="mt-2 text-sm text-muted">Changing the slug keeps the old collection address working.</p>
        {state.errors.slug ? <p className="mt-2 text-sm text-burgundy">{state.errors.slug}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-description`} className="text-sm font-medium text-forest">Description</label>
        <textarea id={`${formId}-description`} name="description" defaultValue={values.description} required maxLength={500} rows={4} className={fieldClass} />
        {state.errors.description ? <p className="mt-2 text-sm text-burgundy">{state.errors.description}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-order`} className="text-sm font-medium text-forest">Display order</label>
        <input id={`${formId}-order`} name="displayOrder" inputMode="numeric" defaultValue={values.displayOrder} required className={fieldClass} />
        <p className="mt-2 text-sm text-muted">Lower numbers appear first.</p>
        {state.errors.displayOrder ? <p className="mt-2 text-sm text-burgundy">{state.errors.displayOrder}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-alt`} className="text-sm font-medium text-forest">Image alternative text</label>
        <input id={`${formId}-alt`} name="imageAlt" defaultValue={values.imageAlt} maxLength={300} className={fieldClass} />
        {state.errors.imageAlt ? <p className="mt-2 text-sm text-burgundy">{state.errors.imageAlt}</p> : null}
        {state.errors.imageUrl ? <p className="mt-2 text-sm text-burgundy">{state.errors.imageUrl}</p> : null}
        <p className="mt-3 break-all text-sm text-muted">{imageUrl || "No image selected. The collection page can still open without one."}</p>
        <label htmlFor={`${formId}-existing`} className="mt-3 block text-sm font-medium text-forest">Photograph</label>
        <select
          id={`${formId}-existing`}
          defaultValue=""
          onChange={(event) => {
            setImageUrl(event.target.value);
            event.target.value = "";
          }}
          className={fieldClass}
        >
          <option value="">Choose a photograph</option>
          {localImages.map((url) => (
            <option key={url} value={url}>{url}</option>
          ))}
        </select>
        {cloudinaryReady ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onUpload(file);
            }}
            className="mt-3 block w-full text-sm"
          />
        ) : null}
        {imageUrl ? (
          <button type="button" onClick={() => setImageUrl("")} className="mt-3 min-h-11 text-sm text-burgundy underline decoration-gold underline-offset-4">
            Remove image
          </button>
        ) : null}
        {uploadMessage ? <p className="mt-2 text-sm text-burgundy">{uploadMessage}</p> : null}
        {uploading ? <p className="mt-2 text-sm text-muted">Uploading…</p> : null}
      </div>
      <label className="inline-flex min-h-12 items-center gap-3 text-sm text-forest">
        <input type="checkbox" name="active" defaultChecked={values.active} className="size-4 accent-burgundy" />
        Active in navigation and collection pages
      </label>
      <SubmitButton label={categoryId ? "Save category" : "Create category"} />
    </form>
  );
}
