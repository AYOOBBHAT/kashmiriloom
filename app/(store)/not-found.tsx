import Link from "next/link";
import { Container } from "@/components/container";

export default function StoreNotFound() {
  return (
    <div className="py-24 sm:py-32">
      <Container>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">
          Missing page
        </p>
        <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight text-forest sm:text-6xl">
          That page is not in this edit.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          The address does not match a shawl or collection in the sample catalogue.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link
            href="/shop"
            className="inline-flex min-h-12 items-center justify-center bg-burgundy px-7 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest"
          >
            Shop shawls
          </Link>
          <Link href="/" className="text-base text-forest underline decoration-gold underline-offset-4">
            Return home
          </Link>
        </div>
      </Container>
    </div>
  );
}
