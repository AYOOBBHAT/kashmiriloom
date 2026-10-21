"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateProduct } from "@/app/admin/actions";
import { Dialog } from "@/components/dialog";

export function DeactivateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deactivateProduct(id);
      setMessage(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center text-sm text-burgundy underline decoration-gold underline-offset-4"
      >
        Archive
      </button>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <Dialog open={open} title={`Archive ${name}`} onClose={() => setOpen(false)}>
        <p className="text-base leading-relaxed text-ink">
          This archives the shawl and hides it from the shop. The catalogue record stays, so past orders still refer to it.
          You can make it active again from the edit page.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex min-h-12 items-center justify-center bg-burgundy px-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
          >
            {pending ? "Archiving…" : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-12 items-center justify-center border border-forest px-5 text-sm text-forest"
          >
            Keep active
          </button>
        </div>
      </Dialog>
    </>
  );
}
