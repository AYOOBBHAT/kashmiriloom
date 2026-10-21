import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Container } from "@/components/container";
import { formatInrFromPaise } from "@/lib/money";
import { formatOrderTime } from "@/lib/orders/format";
import { fulfilmentLabels } from "@/lib/orders/status";
import { getCurrentCustomer } from "@/lib/customers/current";
import { listOwnedOrders } from "@/lib/customers/orders";
import { paymentLabels } from "@/lib/payments/status";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function AccountOrdersPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<Container className="py-16"><p className="text-muted">Loading your orders…</p></Container>}>
      <OrderHistory searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderHistory({ searchParams }: PageProps) {
  await connection();
  const customer = await getCurrentCustomer();
  if (!customer) {
    return null;
  }
  const params = await searchParams;
  const requested = Number(first(params.page));
  const history = await listOwnedOrders(customer.id, requested);
  return (
    <Container className="py-12 sm:py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Account</p>
      <h1 className="mt-3 font-serif text-5xl text-forest">Your orders</h1>
      {history.orders.length === 0 ? (
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
          Orders placed while you are signed in appear here. Guest orders stay on their own confirmation page.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-gold/70">
          {history.orders.map((order) => (
            <li key={order.reference} className="py-5">
              <Link href={`/account/orders/${order.reference}`} className="font-serif text-3xl text-forest underline decoration-gold underline-offset-4">
                {order.reference}
              </Link>
              <p className="mt-2 text-sm text-muted">
                {formatOrderTime(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "shawl" : "shawls"} · {formatInrFromPaise(order.totalPaise)}
              </p>
              <p className="mt-1 text-sm text-ink">
                {paymentLabels[order.paymentStatus]} · {fulfilmentLabels[order.fulfilmentStatus]}
              </p>
            </li>
          ))}
        </ul>
      )}
      {history.pageCount > 1 ? (
        <p className="mt-6 text-sm text-muted">
          Page {history.page} of {history.pageCount}
          {history.page > 1 ? (
            <>
              {" "}
              <Link href={`/account/orders?page=${history.page - 1}`} className="text-forest underline decoration-gold underline-offset-4">
                Previous
              </Link>
            </>
          ) : null}
          {history.page < history.pageCount ? (
            <>
              {" "}
              <Link href={`/account/orders?page=${history.page + 1}`} className="text-forest underline decoration-gold underline-offset-4">
                Next
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </Container>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
