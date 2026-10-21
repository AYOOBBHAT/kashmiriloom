"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CatalogueProblem } from "@/lib/catalogue-error";
import { shopHref, type ShopQuery, type ShopSort } from "@/lib/shop";
import type { ProductDto } from "@/lib/products/types";
import { CatalogueProblem as CatalogueProblemPanel } from "@/components/catalogue-status";
import { ProductCard } from "@/components/product-card";

const sortOptions: { value: ShopSort; label: string }[] = [
  { value: "edited", label: "As edited" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name", label: "Name" },
];

type ShopCatalogProps = {
  products: ProductDto[];
  query: ShopQuery;
  problem: CatalogueProblem | null;
  invalidMessage: string | null;
};

export function ShopCatalog({
  products,
  query,
  problem,
  invalidMessage,
  categories,
}: ShopCatalogProps & { categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const [seenSearch, setSeenSearch] = useState(query.search);
  const timer = useRef<number | null>(null);

  if (seenSearch !== query.search) {
    setSeenSearch(query.search);
    setSearch(query.search);
  }

  const filtersActive = query.search !== "" || query.category !== "all" || query.sort !== "edited";

  function replace(next: ShopQuery) {
    router.replace(shopHref(next), { scroll: false });
  }

  function changeSearch(value: string) {
    setSearch(value);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      replace({ ...query, search: value });
    }, 300);
  }

  return (
    <div>
      <form
        role="search"
        className="mt-10 grid gap-6 border-t border-gold/60 pt-8 lg:grid-cols-[minmax(0,1.4fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (timer.current !== null) {
            window.clearTimeout(timer.current);
          }
          replace({ ...query, search });
        }}
      >
        <div>
          <label
            htmlFor="shop-search"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy"
          >
            Search
          </label>
          <input
            id="shop-search"
            type="search"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search by name or description"
            autoComplete="off"
            maxLength={80}
            className="mt-2 w-full border-b border-forest/30 bg-transparent py-3 text-base text-ink placeholder:text-muted"
          />
        </div>
        <div>
          <label
            htmlFor="shop-sort"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy"
          >
            Sort
          </label>
          <select
            id="shop-sort"
            value={query.sort}
            onChange={(event) => replace({ ...query, search, sort: event.target.value as ShopSort })}
            className="mt-2 min-h-12 w-full border border-gold/80 bg-ivory px-3 text-base text-ink sm:w-64"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      <fieldset className="mt-6">
        <legend className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-burgundy">
          Category
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <CategoryOption
            name="shop-category"
            value="all"
            label="All shawls"
            checked={query.category === "all"}
            onChange={() => replace({ ...query, search, category: "all" })}
          />
          {categories.map((category) => (
            <CategoryOption
              key={category.slug}
              name="shop-category"
              value={category.slug}
              label={category.name}
              checked={query.category === category.slug}
              onChange={() => replace({ ...query, search, category: category.slug })}
            />
          ))}
        </div>
      </fieldset>

      {invalidMessage ? (
        <p role="alert" className="mt-6 text-base text-burgundy">
          {invalidMessage}
        </p>
      ) : null}

      {problem ? <CatalogueProblemPanel problem={problem} /> : null}

      {!problem && !invalidMessage ? (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted">
              {products.length === 0
                ? "No shawls match"
                : `${products.length} ${products.length === 1 ? "shawl" : "shawls"}`}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => replace({ search: "", category: "all", sort: "edited" })}
                className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy underline decoration-gold underline-offset-4"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {products.length === 0 ? (
            <div className="mt-12 border border-gold/70 px-6 py-12 text-center">
              <p className="font-serif text-3xl text-forest">No shawls match</p>
              <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">
                Nothing in the catalogue fits that name, description, or category. Clear the filters
                to see every listed shawl.
              </p>
              <button
                type="button"
                onClick={() => replace({ search: "", category: "all", sort: "edited" })}
                className="mt-6 inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="mt-10 grid min-w-0 list-none gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
              {products.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}

function CategoryOption({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center border px-4 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold ${
        checked ? "border-forest bg-forest text-ivory" : "border-gold/80 text-forest"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}
