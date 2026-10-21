import { benefits } from "@/data/catalog";
import { Container } from "@/components/container";
import { IconCare, IconEdit, IconRupee, IconWeave } from "@/components/icons";
import { SectionHeading } from "@/components/section-heading";

const icons = [IconRupee, IconWeave, IconEdit, IconCare];

export function Benefits() {
  return (
    <section aria-labelledby="house-title" className="border-t border-gold/50 py-20 sm:py-28">
      <Container>
        <SectionHeading id="house" eyebrow="The house" title="What you can count on here">
          <p>
            A calm way to read the cloth: the price, the technique, and how to keep it.
            Standard shipping is free. A shawl that arrives damaged or defective is covered by the refund policy.
          </p>
        </SectionHeading>
        <ul className="mt-12 grid list-none gap-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {benefits.map((benefit, index) => {
            const Icon = icons[index] ?? IconCare;
            return (
              <li key={benefit.title} className="border-t border-gold/70 pt-5">
                <Icon className="h-6 w-6 text-burgundy" />
                <h3 className="mt-4 font-serif text-2xl text-forest">{benefit.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-muted">{benefit.body}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
