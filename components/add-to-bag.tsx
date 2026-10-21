"use client";

import { useState } from "react";
import { MAX_BAG_QUANTITY } from "@/lib/bag";
import { useBag } from "@/components/bag-provider";

type AddToBagProps = {
  slug: string;
  name: string;
  available: boolean;
};

export function AddToBag({ slug, name, available }: AddToBagProps) {
  const { add, catalogueStatus, catalogueMessage } = useBag();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const listed = available && catalogueStatus === "ready";

  function changeQuantity(next: number) {
    setQuantity(Math.min(MAX_BAG_QUANTITY, Math.max(1, next)));
  }

  function onAdd() {
    const result = add(slug, quantity);
    if (!result.ok) {
      if (result.reason === "loading") {
        setMessage("The catalogue is still loading, so the bag was not changed.");
        return;
      }
      if (result.reason === "unknown") {
        setMessage(`${name} is not in the catalogue, so it was not added.`);
        return;
      }
      setMessage(`${name} is not listed in this edit, so it was not added.`);
      return;
    }
    if (result.clamped) {
      setMessage(
        `${name} is in your bag. This sample bag holds up to ${MAX_BAG_QUANTITY} of each shawl. Nothing has been ordered.`,
      );
      return;
    }
    setMessage(`${name} was added to your bag on this device. Nothing has been ordered or paid.`);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={`quantity-${slug}`} className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy">
            Quantity
          </label>
          <div className="mt-2 flex items-center border border-gold/80">
            <button
              type="button"
              onClick={() => changeQuantity(quantity - 1)}
              disabled={!listed || quantity <= 1}
              className="inline-flex h-12 w-12 items-center justify-center text-lg text-forest disabled:text-muted"
              aria-label={`Decrease quantity of ${name}`}
            >
              −
            </button>
            <input
              id={`quantity-${slug}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_BAG_QUANTITY}
              value={quantity}
              disabled={!listed}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) {
                  return;
                }
                changeQuantity(next);
              }}
              className="h-12 w-14 border-x border-gold/80 bg-transparent text-center text-base text-ink"
            />
            <button
              type="button"
              onClick={() => changeQuantity(quantity + 1)}
              disabled={!listed || quantity >= MAX_BAG_QUANTITY}
              className="inline-flex h-12 w-12 items-center justify-center text-lg text-forest disabled:text-muted"
              aria-label={`Increase quantity of ${name}`}
            >
              +
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!listed}
          className="inline-flex min-h-12 items-center justify-center bg-burgundy px-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:cursor-not-allowed disabled:bg-burgundy/40"
        >
          {available ? "Add to bag" : "Not available"}
        </button>
      </div>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        The bag stays on this device until an order is placed. Payment is not taken at checkout.
      </p>
      {catalogueStatus === "loading" ? (
        <p role="status" className="mt-3 max-w-md text-sm text-muted">
          Loading catalogue prices.
        </p>
      ) : null}
      {catalogueStatus === "unavailable" && catalogueMessage ? (
        <p role="alert" className="mt-3 max-w-md text-sm text-muted">
          {catalogueMessage}
        </p>
      ) : null}
      <p role="status" className="mt-3 max-w-md text-base text-forest">
        {message}
      </p>
    </div>
  );
}
