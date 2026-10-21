import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Container } from "@/components/container";
import { formatInrFromPaise } from "@/lib/money";
import { formatOrderTime } from "@/lib/orders/format";
import { fulfilmentLabels } from "@/lib/orders/status";
import { getCurrentCustomer } from "@/lib/customers/current";
import { readOwnedOrder } from "@/lib/customers/orders";
import { paymentLabels } from "@/lib/payments/status";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ reference: string }> };

export default function AccountOrderPage({ params }: PageProps) {
  return (
    <Suspense fallback={<Container className="py-16"><p className="text-muted">Loading the order…</p></Container>}>
      <OwnedOrder params={params} />
    </Suspense>
  );
}

async function OwnedOrder({ params }: PageProps) {
  await connection();
  const customer = await getCurrentCustomer();
  const { reference } = await params;
  const order = customer ? await readOwnedOrder(customer.id, reference) : null;
  if (!order) {
    return (
      <Container className="py-12 sm:py-16">
        <h1 className="font-serif text-5xl text-forest">Order not found</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          That order is not in this account.
        </p>
        <Link href="/account/orders" className="mt-6 inline-flex text-forest underline decoration-gold underline-offset-4">
          Back to your orders
        </Link>
      </Container>
    );
  }
  return (
    <Container className="py-12 sm:py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Your order</p>
      <h1 className="mt-3 font-serif text-5xl text-forest">{order.reference}</h1>
      <p className="mt-3 text-sm text-muted">{formatOrderTime(order.createdAt)}</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-gold/80 px-4 py-4">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Payment</dt>
          <dd className="mt-2 text-lg text-forest">{paymentLabels[order.paymentStatus]}</dd>
        </div>
        <div className="border border-gold/80 px-4 py-4">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Fulfilment</dt>
          <dd className="mt-2 text-lg text-forest">{fulfilmentLabels[order.fulfilmentStatus]}</dd>
        </div>
      </dl>
      <ul className="mt-8 divide-y divide-gold/70">
        {order.lines.map((line) => (
          <li key={`${line.name}-${line.quantity}`} className="flex justify-between gap-4 py-4 text-base text-ink">
            <span>{line.name}</span>
            <span className="text-muted">× {line.quantity}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 font-serif text-3xl text-forest">{formatInrFromPaise(order.totalPaise)}</p>
    </Container>
  );
}
