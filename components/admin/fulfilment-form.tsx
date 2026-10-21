"use client";

import { useActionState } from "react";
import { saveFulfilment, type FulfilmentFormState } from "@/app/admin/order-actions";
import { FULFILMENT_STATUSES, fulfilmentLabels, type FulfilmentStatus } from "@/lib/orders/status";

const emptyState: FulfilmentFormState = { message: "" };

const labels = fulfilmentLabels;

export function FulfilmentForm({
  reference,
  status,
}: {
  reference: string;
  status: FulfilmentStatus;
}) {
  const [state, action, pending] = useActionState(saveFulfilment.bind(null, reference), emptyState);
  if (status === "cancelled") {
    return (
      <p className="mt-4 text-base leading-relaxed text-muted">
        This order is closed. The reserved quantity has been returned to the catalogue.
      </p>
    );
  }
  return (
    <form action={action} className="mt-4 grid gap-4">
      <div>
        <label htmlFor="fulfilment-status" className="text-sm font-medium text-forest">
          Fulfilment
        </label>
        <select
          id="fulfilment-status"
          name="fulfilmentStatus"
          defaultValue={status}
          className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
        >
          {FULFILMENT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {labels[item]}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Cancelling returns quantity only when no Razorpay checkout is open. This form cannot mark an order paid.
        </p>
      </div>
      {state.message ? (
        <p role="status" className="text-sm text-forest">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-fit items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save fulfilment"}
      </button>
    </form>
  );
}
