import type { ReactNode } from "react";
import Link from "next/link";
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

const policyLinkClass = "text-forest underline decoration-gold underline-offset-4";

export function PolicyDocument({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-12 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-5xl text-forest sm:text-6xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{lede}</p>
        <div className="mt-10 space-y-10 text-base leading-relaxed text-ink">{children}</div>
        <nav aria-label="Other policies" className="mt-12 border-t border-gold/70 pt-6">
          <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">Also on this site</h2>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {policyLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-forest underline decoration-gold underline-offset-4">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </Container>
  );
}

export function PolicySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-serif text-3xl text-forest">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function SupportChannels() {
  return (
    <address className="not-italic">
      <p>{PROPRIETOR_NAME}</p>
      <p className="mt-2">{BUSINESS_ADDRESS}</p>
      <ul className="mt-3 space-y-2">
        <li>
          <a className={`inline-flex min-h-11 items-center break-all ${policyLinkClass}`} href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </li>
        <li>
          <a className={`inline-flex min-h-11 items-center ${policyLinkClass}`} href={`tel:${SUPPORT_PHONE_TEL}`}>
            {SUPPORT_PHONE_DISPLAY}
          </a>
        </li>
        <li>
          <a
            className={`inline-flex min-h-11 items-center ${policyLinkClass}`}
            href={SUPPORT_WHATSAPP_URL}
            rel="noopener noreferrer"
          >
            WhatsApp {SUPPORT_PHONE_DISPLAY}
          </a>
        </li>
      </ul>
    </address>
  );
}

export function CheckoutPolicyLinks({ id = "checkout-policies" }: { id?: string }) {
  return (
    <p id={id} className="text-sm leading-relaxed text-muted">
      Before you pay, read the{" "}
      <Link href="/terms-and-conditions" className="text-forest underline decoration-gold underline-offset-4">
        terms
      </Link>
      , the{" "}
      <Link href="/shipping-policy" className="text-forest underline decoration-gold underline-offset-4">
        shipping policy
      </Link>
      , and the{" "}
      <Link href="/refund-policy" className="text-forest underline decoration-gold underline-offset-4">
        refund and cancellation policy
      </Link>
      .
    </p>
  );
}
