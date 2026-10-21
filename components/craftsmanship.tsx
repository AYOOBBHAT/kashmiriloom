import Image from "next/image";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

export function Craftsmanship() {
  return (
    <section aria-labelledby="story-title" className="border-t border-gold/50 py-20 sm:py-28">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="bg-ivory p-3 ring-1 ring-gold/80 sm:p-4">
            <div className="relative aspect-[3/4] sm:aspect-[4/5]">
              <Image
                src="/images/craft-loom.jpg"
                alt="A wooden handloom holding a partly woven burgundy shawl with gold paisleys, with skeins of yarn in the foreground."
                fill
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
          <div>
            <SectionHeading id="story" eyebrow="Our story" title="Built on the loom, finished by the needle">
              <p>
                In the Kani tradition, a shawl is not cut from a bolt. Colour travels
                on small wooden bobbins and is locked into the cloth as the pattern
                grows. A dense paisley field is slow work.
              </p>
            </SectionHeading>
            <div className="mt-6 max-w-xl space-y-5 text-lg leading-relaxed text-muted">
              <p>
                Sozni is a different hand. A needle and fine thread draw flowers onto
                a plain ground, light enough to fold and wear. The two crafts sit
                side by side in Kashmir, and they sit side by side here.
              </p>
              <p>
                KashmiriLoom gathers them into one house: the ceremonial Kani shawl,
                the embroidered piece, and the everyday wrap you reach for without
                ceremony.
              </p>
            </div>
            <blockquote className="mt-8 border-l-2 border-gold pl-5 font-serif text-2xl leading-snug text-forest sm:text-3xl">
              A shawl is not cut from a bolt. The pattern is made as the cloth is made.
            </blockquote>
          </div>
        </div>
      </Container>
    </section>
  );
}
