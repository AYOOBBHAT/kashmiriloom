"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { placeOrder, type PlaceOrderState } from "@/app/(store)/checkout/actions";
import { useBag } from "@/components/bag-provider";
import { CheckoutPolicyLinks } from "@/components/policy-document";
import { RazorpayCheckout } from "@/components/razorpay-checkout";
import { INDIAN_STATES } from "@/lib/orders/address";
import { CHECKOUT_POLICY } from "@/lib/orders/charges";
import { formatInrFromPaise } from "@/lib/money";

const CHECKOUT_KEY = "kashmiriloom-checkout-key";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const emptyState: PlaceOrderState = { message: "", fields: {}, reference: "", code: "" };

const fieldClass =
  "mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest";

export function CheckoutForm({ accountEmail = "" }: { accountEmail?: string }) {
  const router = useRouter();
  const formId = useId();
  const bag = useBag();
  const [state, action, pending] = useActionState(placeOrder, emptyState);
  const [replacedKey, setReplacedKey] = useState(false);
  const keyRef = useRef("");

  function checkoutKey() {
    if (UUID.test(keyRef.current)) {
      return keyRef.current;
    }
    const existing = window.sessionStorage.getItem(CHECKOUT_KEY) ?? "";
    if (UUID.test(existing)) {
      keyRef.current = existing;
      return existing;
    }
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(CHECKOUT_KEY, next);
    keyRef.current = next;
    return next;
  }

  function startAgain() {
    const next = crypto.randomUUID();
    window.sessionStorage.setItem(CHECKOUT_KEY, next);
    keyRef.current = next;
    setReplacedKey(true);
  }

  function submit(formData: FormData) {
    formData.set("idempotencyKey", checkoutKey());
    return action(formData);
  }

  const preview = bag.lines.map((line) => {
    const product = bag.productFor(line.slug);
    if (!product) {
      return { kind: "saved" as const, slug: line.slug, quantity: line.quantity };
    }
    return {
      kind: "known" as const,
      slug: product.slug,
      name: product.name,
      quantity: line.quantity,
      linePaise: product.pricePaise * line.quantity,
    };
  });

  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={submit} className="order-2 grid gap-8 lg:order-1">
        <input type="hidden" name="idempotencyKey" value="" />
        {bag.lines.map((line) => (
          <span key={line.slug}>
            <input type="hidden" name="slug" value={line.slug} />
            <input type="hidden" name="quantity" value={line.quantity} />
          </span>
        ))}
        {state.message ? (
          <p role="alert" className="border border-gold bg-ivory px-4 py-4 text-base leading-relaxed text-ink">
            {state.message}
          </p>
        ) : null}
        {state.code === "mismatch" && !replacedKey ? (
          <button
            type="button"
            onClick={startAgain}
            className="inline-flex min-h-12 items-center justify-center border border-forest px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-forest"
          >
            Start a new checkout
          </button>
        ) : null}

        <fieldset className="grid gap-5">
          <legend className="font-serif text-3xl text-forest">Contact</legend>
          <Field id={`${formId}-name`} name="name" label="Full name" autoComplete="name" error={state.fields.name} required />
          <Field id={`${formId}-email`} name="email" label="Email" type="email" autoComplete="email" error={state.fields.email} required defaultValue={accountEmail} />
          <Field id={`${formId}-phone`} name="phone" label="Mobile number" type="tel" autoComplete="tel" error={state.fields.phone} required />
        </fieldset>

        <fieldset className="grid gap-5">
          <legend className="font-serif text-3xl text-forest">Delivery address</legend>
          <p className="text-sm leading-relaxed text-muted">Delivery is within India.</p>
          <Field id={`${formId}-line1`} name="line1" label="Address line 1" autoComplete="address-line1" error={state.fields.line1} required />
          <Field id={`${formId}-line2`} name="line2" label="Address line 2" autoComplete="address-line2" error={state.fields.line2} />
          <Field id={`${formId}-city`} name="city" label="City" autoComplete="address-level2" error={state.fields.city} required />
          <div>
            <label htmlFor={`${formId}-state`} className="text-sm font-medium text-forest">
              State or union territory
            </label>
            <select id={`${formId}-state`} name="state" defaultValue="" autoComplete="address-level1" required className={fieldClass} aria-invalid={state.fields.state ? true : undefined} aria-describedby={state.fields.state ? `${formId}-state-error` : undefined}>
              <option value="">Choose a state</option>
              {INDIAN_STATES.map((stateName) => (
                <option key={stateName} value={stateName}>
                  {stateName}
                </option>
              ))}
            </select>
            <FieldError id={`${formId}-state-error`} message={state.fields.state} />
          </div>
          <Field id={`${formId}-pin`} name="postalCode" label="PIN code" autoComplete="postal-code" inputMode="numeric" error={state.fields.postalCode} required />
          <input type="hidden" name="country" value="IN" />
        </fieldset>

        {state.fields.lines ? <p className="text-sm text-burgundy">{state.fields.lines}</p> : null}
        <CheckoutPolicyLinks />
        <div>
          <button
            type="submit"
            disabled={pending || bag.lines.length === 0 || Boolean(state.reference)}
            className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>
          {state.reference ? (
            <div className="mt-6">
              <RazorpayCheckout
                reference={state.reference}
                onPaid={() => {
                  bag.clear();
                  window.sessionStorage.removeItem(CHECKOUT_KEY);
                  router.push(`/orders/${state.reference}`);
                }}
              />
            </div>
          ) : null}
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{CHECKOUT_POLICY.paymentDetail}</p>
        </div>
      </form>

      <aside className="order-1 h-fit border border-gold/80 bg-ivory px-5 py-5 lg:order-2">
        <h2 className="font-serif text-3xl text-forest">Order summary</h2>
        {bag.catalogueStatus === "loading" ? (
          <p className="mt-4 text-base text-muted">Loading catalogue prices.</p>
        ) : null}
        {preview.length === 0 ? (
          <p className="mt-4 text-base leading-relaxed text-muted">Your bag is empty. Add a shawl before checkout.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gold/70">
            {preview.map((item) =>
              item.kind === "known" ? (
                <li key={item.slug} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="text-base text-ink">
                    {item.name}
                    <span className="text-muted"> × {item.quantity}</span>
                  </span>
                  <span className="text-sm text-forest">{formatInrFromPaise(item.linePaise)}</span>
                </li>
              ) : (
                <li key={item.slug} className="py-3 text-base text-ink">
                  Saved shawl <span className="text-muted">× {item.quantity}</span>
                </li>
              ),
            )}
          </ul>
        )}
        <ChargeRows subtotalPaise={bag.subtotalPaise} />
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The amount is confirmed from the catalogue when the order is placed. Catalogue quantity is not a verified warehouse count.
        </p>
      </aside>
    </div>
  );
}

function ChargeRows({ subtotalPaise }: { subtotalPaise: number | null }) {
  return (
    <dl className="mt-4 grid gap-3 border-t border-gold/70 pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-muted">Shawls</dt>
        <dd className="text-sm text-ink">{subtotalPaise === null ? "Confirmed at order" : formatInrFromPaise(subtotalPaise)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-muted">{CHECKOUT_POLICY.shippingLabel}</dt>
        <dd className="text-right text-sm text-ink">Free</dd>
      </div>
      <p className="text-sm leading-relaxed text-muted">{CHECKOUT_POLICY.shippingDetail}</p>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-sm text-muted">{CHECKOUT_POLICY.taxLabel}</dt>
        <dd className="text-sm text-ink">Not added</dd>
      </div>
      <p className="text-sm leading-relaxed text-muted">{CHECKOUT_POLICY.taxDetail}</p>
      <div className="flex items-baseline justify-between gap-4 border-t border-gold/70 pt-3">
        <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Amount</dt>
        <dd className="font-serif text-3xl text-forest">
          {subtotalPaise === null ? "—" : formatInrFromPaise(subtotalPaise)}
        </dd>
      </div>
    </dl>
  );
}

function Field({
  id,
  name,
  label,
  error,
  type = "text",
  autoComplete,
  inputMode,
  required = false,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  type?: string;
  autoComplete: string;
  inputMode?: "numeric" | "text";
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-forest">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
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
