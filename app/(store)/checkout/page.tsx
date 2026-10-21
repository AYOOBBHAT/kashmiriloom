import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { Container } from "@/components/container";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <Container className="py-12 sm:py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Checkout</p>
      <h1 className="mt-3 max-w-3xl font-serif text-5xl text-forest sm:text-6xl">Place an order</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        No account is required. The shawls are reserved from the catalogue. Payment is not taken on this page.
      </p>
      <CheckoutForm />
    </Container>
  );
}
