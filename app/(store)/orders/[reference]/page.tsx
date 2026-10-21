import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Container } from "@/components/container";
import { RazorpayCheckout } from "@/components/razorpay-checkout";
import { formatInrFromPaise } from "@/lib/money";
import { CHECKOUT_POLICY } from "@/lib/orders/charges";
import { formatOrderTime, formatPhone } from "@/lib/orders/format";
import { readPublicOrder, type PublicOrder } from "@/lib/orders/lookup";
import { ORDER_VIEW_COOKIE } from "@/lib/orders/view-cookie";
import { livePaymentGateway } from "@/lib/payments/razorpay";
import { reconcileUnpaidOrder } from "@/lib/payments/service";
import { paymentLabels } from "@/lib/payments/status";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ reference: string }>;
};

const fulfilmentLabel: Record<PublicOrder["fulfilmentStatus"], string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <Container className="py-16">
          <p className="text-muted">Loading the order…</p>
        </Container>
      }
    >
      <Confirmation params={params} />
    </Suspense>
  );
}

async function Confirmation({ params }: PageProps) {
  await connection();
  const { reference } = await params;
  await reconcileUnpaidOrder(reference, livePaymentGateway());
  const jar = await cookies();
  const order = await readPublicOrder(reference, jar.get(ORDER_VIEW_COOKIE)?.value);

  return (
    <Container className="py-12 sm:py-16">
      {order ? <OrderReceipt order={order} /> : <MissingOrder />}
    </Container>
  );
}

function MissingOrder() {
  return (
    <>
      <h1 className="font-serif text-5xl text-forest">Order not found</h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        That order reference is not available. Check the reference from the checkout confirmation.
      </p>
      <Link href="/shop" className="mt-8 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
        Back to the shop
      </Link>
    </>
  );
}

function OrderReceipt({ order }: { order: PublicOrder }) {
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Order placed</p>
      <h1 className="mt-3 font-serif text-5xl text-forest sm:text-6xl">{order.reference}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink">{order.paymentDetail}</p>
      <p className="mt-3 text-sm text-muted">Placed {formatOrderTime(order.createdAt)}</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-gold/80 px-4 py-4">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Payment</dt>
          <dd className="mt-2 text-lg text-forest">{paymentLabels[order.paymentStatus]}. {order.paymentStatus === "paid" ? "The payment was captured and checked on the server." : "This order is not paid."}</dd>
          {order.canPay ? (
            <div className="mt-4">
              <RazorpayCheckout reference={order.reference} />
            </div>
          ) : null}
        </div>
        <div className="border border-gold/80 px-4 py-4">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Fulfilment</dt>
          <dd className="mt-2 text-lg text-forest">{fulfilmentLabel[order.fulfilmentStatus]}</dd>
        </div>
      </dl>
      <h2 className="mt-10 font-serif text-3xl text-forest">Shawls</h2>
      <ul className="mt-4 divide-y divide-gold/70">
        {order.lines.map((line) => (
          <li key={`${line.slug}-${line.sku}`} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
            <div>
              <Link href={`/products/${line.slug}`} className="text-lg text-forest underline decoration-gold underline-offset-4">
                {line.name}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {line.sku} · {line.quantity} × {formatInrFromPaise(line.unitPricePaise)}
              </p>
            </div>
            <p className="text-base text-ink">{formatInrFromPaise(line.unitPricePaise * line.quantity)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid max-w-md gap-3">
        <Row label="Shawls" value={formatInrFromPaise(order.subtotalPaise)} />
        <Row label={CHECKOUT_POLICY.shippingLabel} value={order.shippingPaise === 0 ? "Free" : formatInrFromPaise(order.shippingPaise)} />
        <p className="text-sm leading-relaxed text-muted">{order.shippingDetail}</p>
        <Row label={CHECKOUT_POLICY.taxLabel} value={order.taxPaise === 0 ? "Not added" : formatInrFromPaise(order.taxPaise)} />
        <p className="text-sm leading-relaxed text-muted">{order.taxDetail}</p>
        <div className="flex items-baseline justify-between gap-4 border-t border-gold/70 pt-3">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Amount</dt>
          <dd className="font-serif text-3xl text-forest">{formatInrFromPaise(order.totalPaise)}</dd>
        </div>
      </dl>
      {order.contact && order.address ? (
        <section className="mt-10 max-w-xl">
          <h2 className="font-serif text-3xl text-forest">Delivery</h2>
          <p className="mt-4 text-base leading-relaxed text-ink">
            {order.contact.name}
            <br />
            {order.contact.email}
            <br />
            {formatPhone(order.contact.phone)}
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink">
            {order.address.line1}
            {order.address.line2 ? <><br />{order.address.line2}</> : null}
            <br />
            {order.address.city}, {order.address.state} {order.address.postalCode}
            <br />
            India
          </p>
        </section>
      ) : (
        <p className="mt-10 max-w-xl text-base leading-relaxed text-muted">
          Contact and address stay hidden when this page is opened without the browser that placed the order.
        </p>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}
