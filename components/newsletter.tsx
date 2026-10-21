"use client";

import { FormEvent, useState } from "react";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

export function Newsletter() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!email.includes("@")) {
      return;
    }
    setSubmitted(true);
  }

  return (
    <section aria-labelledby="contact-title" className="bg-burgundy py-20 text-ivory sm:py-28">
      <Container>
        <div className="grid items-end gap-12 lg:grid-cols-2">
          <SectionHeading
            id="contact"
            eyebrow="Correspondence"
            title="Letters from the loom"
            tone="inverse"
          >
            <p>
              A short note when a new edit is ready. Leave an address if you wish —
              this preview does not store it or send mail.
            </p>
          </SectionHeading>
          {submitted ? (
            <p role="status" className="max-w-md text-lg leading-relaxed text-ivory">
              Thank you. Nothing was saved or sent. The list opens with a later edition.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="max-w-md">
              <label
                htmlFor="newsletter-email"
                className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-ivory"
              >
                Email address
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="name@email.com"
                className="mt-3 w-full border-b border-ivory/70 bg-transparent py-3 text-base text-ivory placeholder:text-[#e7d7c8]"
              />
              <button
                type="submit"
                className="mt-6 inline-flex min-h-12 items-center justify-center bg-gold px-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-forest hover:bg-ivory"
              >
                Join the list
              </button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
