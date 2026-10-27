"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { primaryNav } from "@/data/catalog";
import { matchesCatalogueSearch } from "@/lib/shop";
import { formatInrFromPaise } from "@/lib/money";
import { useCatalogue } from "@/lib/catalogue-store";
import { BagPanel } from "@/components/bag-panel";
import { useBag } from "@/components/bag-provider";
import { Dialog } from "@/components/dialog";
import { IconBag, IconMenu, IconSearch } from "@/components/icons";

export function SiteHeader() {
  const { count } = useBag();
  const catalogue = useCatalogue();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    setSearchOpen(false);
    setCartOpen(false);
    setMenuOpen(true);
  }

  function openSearch() {
    setMenuOpen(false);
    setCartOpen(false);
    setSearchOpen(true);
  }

  function openCart() {
    setMenuOpen(false);
    setSearchOpen(false);
    setCartOpen(true);
  }

  function restore(trigger: { current: HTMLElement | null }) {
    window.setTimeout(() => trigger.current?.focus(), 0);
  }

  const results =
    catalogue.status === "ready"
      ? catalogue.products.filter((product) => matchesCatalogueSearch(product, query))
      : [];

  const bagLabel =
    count === 0
      ? "Shopping bag, empty"
      : `Shopping bag, ${count} ${count === 1 ? "item" : "items"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-gold/60 bg-ivory/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full min-w-0 max-w-7xl items-center gap-2 px-4 sm:h-20 sm:gap-4 sm:px-8">
        <button
          type="button"
          ref={menuButtonRef}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-forest md:hidden"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={openMenu}
        >
          <IconMenu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </button>

        <Link
          href="/"
          className="min-w-0 truncate font-serif text-lg tracking-tight text-forest sm:text-2xl md:text-[1.75rem]"
        >
          KashmiriLoom
        </Link>

        <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-2 md:flex" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-forest hover:text-burgundy"
            >
              {item.label}
            </Link>
          ))}
          {catalogue.categories.map((category) => (
            <Link
              key={category.slug}
              href={`/collections/${category.slug}`}
              prefetch={true}
              className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-forest hover:text-burgundy"
            >
              {category.name}
            </Link>
          ))}
          <Link href="/account" className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-forest hover:text-burgundy">
            Account
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            ref={searchButtonRef}
            className="inline-flex h-11 w-11 items-center justify-center text-forest"
            aria-expanded={searchOpen}
            aria-haspopup="dialog"
            onClick={openSearch}
          >
            <IconSearch className="h-5 w-5" />
            <span className="sr-only">Search shawls</span>
          </button>
          <button
            type="button"
            ref={cartButtonRef}
            className="relative inline-flex h-11 w-11 items-center justify-center text-forest"
            aria-expanded={cartOpen}
            aria-haspopup="dialog"
            onClick={openCart}
          >
            <IconBag className="h-5 w-5" />
            <span className="sr-only">{bagLabel}</span>
            {count > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-0 inline-flex h-5 min-w-5 items-center justify-center bg-burgundy px-1 text-[0.65rem] font-semibold text-ivory"
              >
                {count}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <Dialog
        open={menuOpen}
        title="Explore"
        align="start"
        onClose={() => {
          setMenuOpen(false);
          restore(menuButtonRef);
        }}
        initialFocusRef={firstMenuLinkRef}
      >
        <nav aria-label="Mobile" className="flex flex-col gap-5">
          {primaryNav.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              ref={index === 0 ? firstMenuLinkRef : undefined}
              onClick={() => setMenuOpen(false)}
              className="font-serif text-4xl text-forest"
            >
              {item.label}
            </Link>
          ))}
          {catalogue.categories.map((category) => (
            <Link
              key={category.slug}
              href={`/collections/${category.slug}`}
              prefetch={true}
              onClick={() => setMenuOpen(false)}
              className="font-serif text-4xl text-forest"
            >
              {category.name}
            </Link>
          ))}
          <Link href="/account" onClick={() => setMenuOpen(false)} className="font-serif text-4xl text-forest">
            Account
          </Link>
        </nav>
      </Dialog>

      <Dialog
        open={searchOpen}
        title="Search shawls"
        onClose={() => {
          setSearchOpen(false);
          restore(searchButtonRef);
        }}
        initialFocusRef={searchInputRef}
      >
        <form role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="shawl-search" className="sr-only">
            Search by name or description
          </label>
          <input
            ref={searchInputRef}
            id="shawl-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or description"
            autoComplete="off"
            className="w-full border-b border-forest/30 bg-transparent py-3 text-base text-ink placeholder:text-muted"
          />
        </form>
        <p aria-live="polite" className="mt-4 text-sm text-muted">
          {catalogue.status === "loading"
            ? "Loading the catalogue."
            : catalogue.status === "unavailable"
              ? catalogue.message
              : results.length === 0
                ? "No shawls match that search."
                : `${results.length} ${results.length === 1 ? "shawl" : "shawls"}`}
        </p>
        <ul className="mt-2 max-h-80 divide-y divide-gold/70 overflow-auto">
          {results.map((product) => (
            <li key={product.slug}>
              <Link
                href={`/products/${product.slug}`}
                onClick={() => setSearchOpen(false)}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span>
                  <span className="block font-serif text-2xl text-forest">{product.name}</span>
                  <span className="text-sm text-muted">{product.categoryName}</span>
                </span>
                <span className="shrink-0 text-sm text-ink">{formatInrFromPaise(product.pricePaise)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={cartOpen}
        title="Your bag"
        onClose={() => {
          setCartOpen(false);
          restore(cartButtonRef);
        }}
      >
        <BagPanel onNavigate={() => setCartOpen(false)} />
      </Dialog>
    </header>
  );
}
