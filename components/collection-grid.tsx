import Image from "next/image";
import Link from "next/link";
import { collections } from "@/data/catalog";
import { Container } from "@/components/container";
import { SectionHeading } from "@/components/section-heading";

export function CollectionGrid() {
  return (
    <section aria-labelledby="collections-title" className="py-20 sm:py-28">
      <Container>
        <SectionHeading id="collections" eyebrow="Collections" title="Three ways to wear the valley">
          <p>
            Ceremonial weaving, fine embroidery, and shawls kept for every day.
          </p>
        </SectionHeading>
        <ul className="mt-12 grid min-w-0 list-none gap-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-8">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link href={`/collections/${collection.slug}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden bg-forest/10">
                  <Image
                    src={collection.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover motion-safe:transition motion-safe:duration-700 motion-safe:group-hover:scale-105"
                  />
                </div>
                <h3 className="mt-5 font-serif text-3xl text-forest">{collection.name}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{collection.description}</p>
                <span className="mt-4 inline-block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-burgundy">
                  View pieces
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
