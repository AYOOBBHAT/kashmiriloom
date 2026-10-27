"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadCatalogueImageFile } from "@/components/admin/direct-upload";
import { FormFeedback } from "@/components/admin/form-feedback";
import type { CategoryFormState } from "@/app/admin/category-actions";

const fieldClass =
  "mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest";

const emptyState: CategoryFormState = { message: "", errors: {}, attempt: 0 };

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

function SubmitButton({ label, busy }: { label: string; busy: boolean }) {
  const { pending } = useFormStatus();
  const waiting = pending || busy;
  return (
    <button type="submit" disabled={waiting} aria-busy={pending} className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60">
      {pending ? "Saving..." : label}
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
  const uploadRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction] = useActionState(action, emptyState);
  const [imageUrl, setImageUrl] = useState(values.imageUrl);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dismissNotice, setDismissNotice] = useState(false);
  const fields = state.entered ?? values;

  useEffect(() => {
    if (uploadMessage) {
      uploadRef.current?.focus();
    }
  }, [uploadMessage]);

  async function onUpload(file: File | undefined) {
    if (!file) {
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
    setImageUrl(result.url);
  }

  return (
    <form key={state.attempt} action={formAction} onSubmit={() => { setDismissNotice(true); setUploadMessage(""); }} className="mt-8 max-w-2xl space-y-6">
      <input type="hidden" name="expectedUpdatedAt" value={fields.expectedUpdatedAt} />
      <input type="hidden" name="imageUrl" value={imageUrl} />
      <FormFeedback notice={dismissNotice ? "" : notice} error={state.message} />
      <div>
        <label htmlFor={`${formId}-name`} className="text-sm font-medium text-forest">Name</label>
        <input id={`${formId}-name`} name="name" defaultValue={fields.name} required maxLength={80} aria-invalid={Boolean(state.errors.name)} aria-describedby={state.errors.name ? `${formId}-name-error` : undefined} className={fieldClass} />
        {state.errors.name ? <p id={`${formId}-name-error`} className="mt-2 text-sm text-burgundy">{state.errors.name}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-slug`} className="text-sm font-medium text-forest">Slug</label>
        <input id={`${formId}-slug`} name="slug" defaultValue={fields.slug} required maxLength={80} aria-invalid={Boolean(state.errors.slug)} aria-describedby={state.errors.slug ? `${formId}-slug-error` : `${formId}-slug-help`} className={fieldClass} />
        <p id={`${formId}-slug-help`} className="mt-2 text-sm text-muted">Changing the slug keeps the old collection address working.</p>
        {state.errors.slug ? <p id={`${formId}-slug-error`} className="mt-2 text-sm text-burgundy">{state.errors.slug}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-description`} className="text-sm font-medium text-forest">Description</label>
        <textarea id={`${formId}-description`} name="description" defaultValue={fields.description} required maxLength={500} rows={4} aria-invalid={Boolean(state.errors.description)} aria-describedby={state.errors.description ? `${formId}-description-error` : undefined} className={fieldClass} />
        {state.errors.description ? <p id={`${formId}-description-error`} className="mt-2 text-sm text-burgundy">{state.errors.description}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-order`} className="text-sm font-medium text-forest">Display order</label>
        <input id={`${formId}-order`} name="displayOrder" inputMode="numeric" defaultValue={fields.displayOrder} required aria-invalid={Boolean(state.errors.displayOrder)} aria-describedby={state.errors.displayOrder ? `${formId}-order-error` : undefined} className={fieldClass} />
        <p className="mt-2 text-sm text-muted">Lower numbers appear first.</p>
        {state.errors.displayOrder ? <p id={`${formId}-order-error`} className="mt-2 text-sm text-burgundy">{state.errors.displayOrder}</p> : null}
      </div>
      <div>
        <label htmlFor={`${formId}-alt`} className="text-sm font-medium text-forest">Image alternative text</label>
        <input id={`${formId}-alt`} name="imageAlt" defaultValue={fields.imageAlt} maxLength={300} aria-invalid={Boolean(state.errors.imageAlt)} aria-describedby={state.errors.imageAlt ? `${formId}-alt-error` : undefined} className={fieldClass} />
        {state.errors.imageAlt ? <p id={`${formId}-alt-error`} className="mt-2 text-sm text-burgundy">{state.errors.imageAlt}</p> : null}
        {state.errors.imageUrl ? <p id={`${formId}-image-error`} className="mt-2 text-sm text-burgundy">{state.errors.imageUrl}</p> : null}
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
            form="catalogue-file-upload"
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
        {uploadMessage ? <p ref={uploadRef} tabIndex={-1} role="alert" className="mt-2 text-sm text-burgundy outline-none">{uploadMessage}</p> : null}
        {uploading ? <p className="mt-2 text-sm text-muted">Uploading…</p> : null}
      </div>
      <label className="inline-flex min-h-12 items-center gap-3 text-sm text-forest">
        <input type="checkbox" name="active" defaultChecked={fields.active} className="size-4 accent-burgundy" />
        Active in navigation and collection pages
      </label>
      <SubmitButton label={categoryId ? "Save category" : "Create category"} busy={uploading} />
    </form>
  );
}
