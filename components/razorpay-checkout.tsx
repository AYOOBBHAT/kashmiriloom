"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmCheckout, prepareCheckout } from "@/app/(store)/checkout/payment-actions";

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: () => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: "INR";
      name: string;
      description: string;
      order_id: string;
      theme: { color: string };
      modal: { ondismiss: () => void };
      handler: (response: { razorpay_payment_id?: string; razorpay_signature?: string }) => void;
    }) => RazorpayCheckoutInstance;
  }
}

const UNCONFIRMED = "The payment was not confirmed. This order stays unpaid and the shawls stay reserved.";

export function RazorpayCheckout({
  reference,
  onPaid,
}: {
  reference: string;
  onPaid?: () => void;
}) {
  const router = useRouter();
  const opening = useRef(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function openCheckout() {
    if (opening.current) {
      return;
    }
    opening.current = true;
    setBusy(true);
    setMessage("");
    try {
      const prepared = await prepareCheckout(reference);
      if (!prepared.ok) {
        setMessage(prepared.message);
        return;
      }
      if (prepared.alreadyPaid) {
        finish();
        return;
      }
      if (!prepared.keyId.startsWith("rzp_test_")) {
        setMessage("Live payments are turned off. This shop only opens Razorpay test checkout.");
        return;
      }
      await loadCheckoutScript();
      if (!window.Razorpay) {
        setMessage("Razorpay test checkout could not be opened. You can try again. This order stays unpaid.");
        return;
      }
      const checkout = new window.Razorpay({
        key: prepared.keyId,
        amount: prepared.amount,
        currency: prepared.currency,
        name: "KashmiriLoom",
        description: prepared.description,
        order_id: prepared.orderId,
        theme: { color: "#244538" },
        modal: {
          ondismiss: () => {
            setMessage("Checkout was closed. Nothing was marked paid. The shawls stay reserved until the hold ends.");
          },
        },
        handler: (response) => {
          void finishPayment(response.razorpay_payment_id, response.razorpay_signature);
        },
      });
      checkout.on("payment.failed", () => {
        setMessage("The payment attempt failed. This order stays unpaid. You can try the same reserved order again.");
      });
      checkout.open();
    } catch {
      setMessage("Razorpay test checkout could not be opened. You can try again. This order stays unpaid.");
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }

  async function finishPayment(paymentId: string | undefined, signature: string | undefined) {
    if (!paymentId || !signature) {
      setMessage(UNCONFIRMED);
      return;
    }
    setBusy(true);
    const result = await confirmCheckout(reference, paymentId, signature);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    finish();
  }

  function finish() {
    if (onPaid) {
      onPaid();
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={() => void openCheckout()}
        disabled={busy}
        className="inline-flex min-h-12 items-center justify-center bg-forest px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-burgundy disabled:opacity-60"
      >
        {busy ? "Checking payment…" : "Pay with Razorpay test checkout"}
      </button>
      {message ? (
        <p role="status" className="text-sm leading-relaxed text-ink">
          {message}
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          This opens Razorpay in test mode for the reserved order. Closing it does not mark the order paid.
        </p>
      )}
    </div>
  );
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-razorpay-checkout]");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay checkout did not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout did not load."));
    document.body.appendChild(script);
  });
}
