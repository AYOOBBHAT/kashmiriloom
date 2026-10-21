import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { formatInrFromPaise } from "@/lib/money";
import { LOW_STOCK_AT } from "@/lib/products/admin-query";
import { countOrders, type OrderCounts } from "@/lib/orders/admin";
import {
  AdminAccessError,
  getAdminOverview,
  type AdminListItem,
} from "@/lib/products/admin-repository";

export const metadata: Metadata = {
  title: "Overview",
};

function formatUpdated(value: string): string {
  if (!value) {
    return "Not recorded";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="border border-gold/80 bg-ivory px-5 py-5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-burgundy">{label}</p>
      <p className="mt-3 font-serif text-4xl text-forest">{value}</p>
    </article>
  );
}

function ProductLine({ product }: { product: AdminListItem }) {
  return (
    <li className="border-t border-gold/60 py-3">
      <Link href={`/admin/products/${product.id}/edit`} className="text-forest underline decoration-gold underline-offset-4">
        {product.name}
      </Link>
      <p className="mt-1 text-sm text-muted">
        {product.categoryName} · {formatInrFromPaise(product.pricePaise)} · quantity {product.stockQuantity}
        {product.lowStock ? " · low" : ""} · {product.status}
      </p>
    </li>
  );
}

async function Overview() {
  let overview: Awaited<ReturnType<typeof getAdminOverview>> | null = null;
  let orders: OrderCounts | null = null;
  let problem = "";
  try {
    overview = await getAdminOverview();
    orders = await countOrders();
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
  if (!overview || !orders) {
    return <p className="text-base leading-relaxed text-ink">{problem}</p>;
  }

  return (
      <>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Overview</p>
        <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">Catalogue</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Products" value={overview.total} />
          <Stat label="Active" value={overview.active} />
          <Stat label="Inactive" value={overview.inactive} />
          <Stat label="Low-quantity shawls" value={overview.lowStockCount} />
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          Low stock uses the quantity stored on each catalogue record. It is not a warehouse check, and sample quantities are not verified inventory.
        </p>
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="font-serif text-3xl text-forest">Low catalogue quantity</h2>
            {overview.lowStock.length === 0 ? (
              <p className="mt-4 text-base leading-relaxed text-muted">
                No shawl is at or below {LOW_STOCK_AT} in catalogue quantity.
              </p>
            ) : (
              <ul className="mt-4">
                {overview.lowStock.map((product) => (
                  <ProductLine key={product.id} product={product} />
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="font-serif text-3xl text-forest">Recent updates</h2>
            {overview.recent.length === 0 ? (
              <p className="mt-4 text-base leading-relaxed text-muted">No shawls have been saved yet.</p>
            ) : (
              <ul className="mt-4">
                {overview.recent.map((product) => (
                  <li key={product.id} className="border-t border-gold/60 py-3">
                    <Link href={`/admin/products/${product.id}/edit`} className="text-forest underline decoration-gold underline-offset-4">
                      {product.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted">{formatUpdated(product.updatedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="mt-10 border border-gold/80 px-5 py-5">
          <h2 className="font-serif text-3xl text-forest">Orders</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Guest checkout reserves shawls, then Razorpay test checkout can be opened. An order stays unpaid until the payment is captured and checked. Live payments are not accepted, and there are no customer accounts.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Orders</dt>
              <dd className="mt-2 font-serif text-4xl text-forest">{orders.total}</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Unpaid</dt>
              <dd className="mt-2 font-serif text-4xl text-forest">{orders.pendingPayment}</dd>
            </div>
            <div>
              <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Open fulfilment</dt>
              <dd className="mt-2 font-serif text-4xl text-forest">{orders.openFulfilment}</dd>
            </div>
          </dl>
          <Link href="/admin/orders" className="mt-6 inline-flex min-h-12 items-center text-forest underline decoration-gold underline-offset-4">
            Review orders
          </Link>
        </section>
      </>
  );
}

export default function AdminHomePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading the catalogue summary…</p>}>
      <Overview />
    </Suspense>
  );
}
