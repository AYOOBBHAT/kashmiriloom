"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeCategory, toggleCategory } from "@/app/admin/category-actions";
import { Dialog } from "@/components/dialog";

export function CategoryActiveButton({ id, active, name }: { id: string; active: boolean; name: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = !active;
          if (!next && !window.confirm(`Deactivate ${name}? Shawls already in it stay saved.`)) {
            return;
          }
          startTransition(async () => {
            const result = await toggleCategory(id, next);
            setMessage(result.message);
            router.refresh();
          });
        }}
        className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4"
      >
        {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}

export function CategoryDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center text-sm text-burgundy underline decoration-gold underline-offset-4">
        Delete
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <Dialog open={open} title={`Delete ${name}`} onClose={() => setOpen(false)}>
        <p className="text-base leading-relaxed text-ink">
          This removes the category only when no shawl still uses it. Past orders are not changed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await removeCategory(id);
                setMessage(result.message);
                setOpen(false);
                router.refresh();
              });
            }}
            className="inline-flex min-h-12 items-center justify-center bg-burgundy px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete category"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-12 items-center border border-forest px-5 text-sm text-forest">
            Keep it
          </button>
        </div>
      </Dialog>
    </>
  );
}
