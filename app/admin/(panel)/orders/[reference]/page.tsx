import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FulfilmentForm } from "@/components/admin/fulfilment-form";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { formatInrFromPaise } from "@/lib/money";
import { AdminAccessError } from "@/lib/products/admin-repository";
import { readAdminOrder, type AdminOrderDetail } from "@/lib/orders/admin";
import { CHECKOUT_POLICY } from "@/lib/orders/charges";
import { formatOrderTime, formatPhone } from "@/lib/orders/format";
import { fulfilmentLabels } from "@/lib/orders/status";
import { paymentLabels } from "@/lib/payments/status";

export const metadata: Metadata = {
  title: "Order",
};

type PageProps = {
  params: Promise<{ reference: string }>;
};

export default function AdminOrderPage({ params }: PageProps) {
  return (
    <Suspense fallback={<p className="text-muted">Loading the order…</p>}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

async function OrderDetail({ params }: PageProps) {
  const { reference } = await params;
  let order: AdminOrderDetail | null = null;
  let problem = "";
  try {
    order = await readAdminOrder(reference);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/admin/login");
    }
    if (error instanceof CatalogueAccessError) {
      problem = error.message;
    } else {
      throw error;
    }
  }
  if (problem) {
    return <p className="text-base leading-relaxed text-ink">{problem}</p>;
  }
  if (!order) {
    return (
      <>
        <h1 className="font-serif text-4xl text-forest">Order not in the desk</h1>
        <Link href="/admin/orders" className="mt-6 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
          Back to orders
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Order</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">{order.reference}</h1>
      <p className="mt-3 text-sm text-muted">Placed {formatOrderTime(order.createdAt)}</p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-gold/80 px-4 py-4">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Payment</dt>
          <dd className="mt-2 text-lg text-forest">{paymentLabels[order.paymentStatus]}</dd>
          {order.razorpayOrderId ? (
            <p className="mt-2 text-sm text-muted">Razorpay order {order.razorpayOrderId}</p>
          ) : null}
          <p className="mt-2 text-sm leading-relaxed text-muted">{CHECKOUT_POLICY.paymentDetail}</p>
        </div>
        <div className="border border-gold/80 px-4 py-4">
          <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Fulfilment</dt>
          <dd className="mt-2 text-lg text-forest">{fulfilmentLabels[order.fulfilmentStatus]}</dd>
          <FulfilmentForm reference={order.reference} status={order.fulfilmentStatus} />
        </div>
      </dl>
      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-3xl text-forest">Shawls</h2>
          <ul className="mt-4 divide-y divide-gold/70">
            {order.lines.map((line) => (
              <li key={`${line.sku}-${line.slug}`} className="py-4">
                <Link href={`/admin/products/${line.productId}/edit`} className="text-forest underline decoration-gold underline-offset-4">
                  {line.name}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {line.sku} · {line.quantity} × {formatInrFromPaise(line.unitPricePaise)} · {formatInrFromPaise(line.unitPricePaise * line.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-2">
            <Amount label="Shawls" value={formatInrFromPaise(order.subtotalPaise)} />
            <Amount label="Delivery" value={order.shippingPaise === 0 ? "Not added" : formatInrFromPaise(order.shippingPaise)} />
            <Amount label="Tax" value={order.taxPaise === 0 ? "Not added" : formatInrFromPaise(order.taxPaise)} />
            <Amount label="Amount" value={formatInrFromPaise(order.totalPaise)} />
          </dl>
        </div>
        <div>
          <h2 className="font-serif text-3xl text-forest">Guest</h2>
          <p className="mt-4 text-base leading-relaxed text-ink">
            {order.name}
            <br />
            {order.email}
            <br />
            {formatPhone(order.phone)}
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink">
            {order.address.line1}
            {order.address.line2 ? <><br />{order.address.line2}</> : null}
            <br />
            {order.address.city}, {order.address.state} {order.address.postalCode}
            <br />
            India
          </p>
        </div>
      </section>
      <Link href="/admin/orders" className="mt-10 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
        Back to orders
      </Link>
    </>
  );
}

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}
