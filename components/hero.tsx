import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b border-gold/50">
      <div className="mx-auto grid w-full min-w-0 max-w-7xl lg:grid-cols-12">
        <div className="relative flex min-w-0 items-center px-5 py-16 sm:px-8 lg:col-span-5 lg:py-24">
          <div
            aria-hidden="true"
            className="pattern-boteh pointer-events-none absolute inset-0 opacity-[0.07]"
          />
          <div className="relative w-full max-w-xl">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-gold" />
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
                The house of KashmiriLoom
              </p>
            </div>
            <h1
              id="hero-title"
              className="mt-5 max-w-full font-serif text-[2.5rem] leading-[1.02] text-balance text-forest sm:text-6xl lg:text-7xl"
            >
              <span className="block">Woven in Kashmir.</span>
              <span className="mt-1 block italic">Made to Be Treasured.</span>
            </h1>
            <p className="mt-6 max-w-full text-lg leading-relaxed text-pretty text-muted sm:max-w-md">
              Kani paisleys, needle-worked flowers, and quiet wool for ordinary days.
              Cloth from the valley, shown here to be worn now and kept long after
              the season turns.
            </p>
            <Link
              href="/shop"
              className="mt-8 inline-flex min-h-12 items-center justify-center bg-burgundy px-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
            >
              Shop Shawls
            </Link>
          </div>
        </div>
        <div className="relative min-h-[22rem] min-w-0 sm:min-h-[34rem] lg:col-span-7 lg:min-h-[46rem]">
          <Image
            src="/images/hero-shawl.jpg"
            alt="A fringed Kashmiri shawl in burgundy, forest green, ivory, and gold paisley, draped over a dark wood chair."
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
