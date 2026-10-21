import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogueAccessError } from "@/lib/catalogue-error";
import { formatInrFromPaise } from "@/lib/money";
import { AdminAccessError } from "@/lib/products/admin-repository";
import { formatOrderTime } from "@/lib/orders/format";
import { ORDER_PAGE_SIZE, listAdminOrders, type AdminOrderList } from "@/lib/orders/admin";
import { fulfilmentLabels, FULFILMENT_STATUSES, type FulfilmentStatus } from "@/lib/orders/status";
import { paymentLabels } from "@/lib/payments/status";

export const metadata: Metadata = {
  title: "Orders",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  const picked = Array.isArray(value) ? value[0] : value;
  return picked ?? "";
}

export default function OrdersPage({ searchParams }: PageProps) {
  return (
    <>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Desk</p>
      <h1 className="mt-3 font-serif text-4xl text-forest sm:text-5xl">Orders</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        Orders from guest checkout and from signed-in customers. Payment is shown from the verified test checkout. Live payments are not accepted.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading orders…</p>}>
        <OrderList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function OrderList({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = first(params.search).slice(0, 24);
  const status = first(params.status);
  const page = Number(first(params.page) || "1");
  let result: AdminOrderList | null = null;
  let problem = "";
  try {
    result = await listAdminOrders(search, status, page);
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
  if (!result) {
    return <p className="mt-8 text-base leading-relaxed text-ink">{problem}</p>;
  }
  const query = { search, status: isStatus(status) ? status : "all" };
  return (
    <>
      <form method="get" className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem_auto] sm:items-end">
        <div>
          <label htmlFor="order-search" className="text-sm font-medium text-forest">
            Order reference
          </label>
          <input
            id="order-search"
            name="search"
            defaultValue={search}
            maxLength={24}
            className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
          />
        </div>
        <div>
          <label htmlFor="order-status" className="text-sm font-medium text-forest">
            Fulfilment
          </label>
          <select
            id="order-status"
            name="status"
            defaultValue={query.status}
            className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
          >
            <option value="all">All</option>
            {FULFILMENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {fulfilmentLabels[item]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
        >
          Filter
        </button>
      </form>
      {result.orders.length === 0 ? (
        <p className="mt-8 text-base leading-relaxed text-muted">No orders match this list.</p>
      ) : (
        <ul className="mt-8 divide-y divide-gold/70">
          {result.orders.map((order) => (
            <li key={order.reference} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div>
                <Link href={`/admin/orders/${order.reference}`} className="text-lg text-forest underline decoration-gold underline-offset-4">
                  {order.reference}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {order.name} · {order.itemCount} {order.itemCount === 1 ? "shawl" : "shawls"} · {formatOrderTime(order.createdAt)}
                </p>
                <p className="mt-1 text-sm text-ink">
                  {formatInrFromPaise(order.totalPaise)} · {paymentLabels[order.paymentStatus]} · {fulfilmentLabels[order.fulfilmentStatus]}
                </p>
              </div>
              <Link
                href={`/admin/orders/${order.reference}`}
                className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
      {result.pageCount > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center gap-4" aria-label="Pages">
          {result.page > 1 ? (
            <Link href={ordersHref({ ...query, page: result.page - 1 })} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Link href={ordersHref({ ...query, page: result.page + 1 })} className="inline-flex min-h-12 items-center text-sm text-forest underline decoration-gold underline-offset-4">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
      <p className="mt-6 text-sm text-muted">{result.total} orders · {ORDER_PAGE_SIZE} per page</p>
    </>
  );
}

function isStatus(value: string): value is FulfilmentStatus | "all" {
  return value === "all" || FULFILMENT_STATUSES.some((status) => status === value);
}

function ordersHref(query: { search: string; status: string; page: number }): string {
  const params = new URLSearchParams();
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.page > 1) {
    params.set("page", String(query.page));
  }
  const text = params.toString();
  return text ? `/admin/orders?${text}` : "/admin/orders";
}
