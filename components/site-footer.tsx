import Link from "next/link";
import { collections, primaryNav } from "@/data/catalog";
import { Container } from "@/components/container";
import {
  BUSINESS_ADDRESS,
  policyLinks,
  PROPRIETOR_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
  SUPPORT_WHATSAPP_URL,
} from "@/lib/site/policies";

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
          <address className="mt-4 text-base not-italic leading-relaxed text-ivory/90">
            <p>{PROPRIETOR_NAME}</p>
            <p className="mt-2">{BUSINESS_ADDRESS}</p>
          </address>
          <ul className="mt-3">
            <li>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center break-all text-base underline decoration-gold/80 underline-offset-4 hover:text-gold">
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              <a href={`tel:${SUPPORT_PHONE_TEL}`} className="inline-flex min-h-11 items-center text-base underline decoration-gold/80 underline-offset-4 hover:text-gold">
                {SUPPORT_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a href={SUPPORT_WHATSAPP_URL} rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-base underline decoration-gold/80 underline-offset-4 hover:text-gold">
                WhatsApp
              </a>
            </li>
            <li>
              <Link href="/contact" className="inline-flex min-h-11 items-center text-base underline decoration-gold/80 underline-offset-4 hover:text-gold">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-ivory/15">
        <Container className="py-6">
          <nav aria-label="Policies">
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
              {policyLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="inline-flex min-h-11 items-center text-sm text-ivory underline decoration-gold/70 underline-offset-4 hover:text-gold">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
      <div className="border-t border-ivory/15">
        <Container className="flex flex-col gap-2 py-5 text-sm text-ivory/85 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 KashmiriLoom</p>
          <p>Sample prices, shown in INR. Standard shipping is free. Damaged or defective shawls are covered by the refund policy.</p>
        </Container>
      </div>
    </footer>
  );
}
