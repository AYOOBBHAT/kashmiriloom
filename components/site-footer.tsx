import Link from "next/link";
import { collections, primaryNav } from "@/data/catalog";
import { Container } from "@/components/container";

export function SiteFooter() {
  return (
    <footer className="bg-forest text-ivory">
      <Container className="grid gap-12 py-16 sm:py-20 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <p className="font-serif text-3xl">KashmiriLoom</p>
          <p className="mt-4 max-w-xs text-base leading-relaxed text-ivory/90">
            A house for traditional Kashmiri shawls — Kani weaves, embroidered pieces,
            and everyday wool.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold">
            Explore
          </h2>
          <ul className="mt-4 space-y-2">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-base hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold">
            Collections
          </h2>
          <ul className="mt-4 space-y-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link href={`/collections/${collection.slug}`} className="text-base hover:text-gold">
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold">
            Write
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ivory/90">
            Questions about a weave can begin with the note on the homepage. A studio
            address and telephone are not listed in this edition.
          </p>
          <Link href="/#contact" className="mt-4 inline-block text-base underline decoration-gold/80 underline-offset-4 hover:text-gold">
            Write to the house
          </Link>
        </div>
      </Container>
      <div className="border-t border-ivory/15">
        <Container className="flex flex-col gap-2 py-5 text-sm text-ivory/85 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 KashmiriLoom</p>
          <p>Sample prices, shown in INR. Checkout does not add a delivery charge. Returns are not offered here.</p>
        </Container>
      </div>
    </footer>
  );
}
