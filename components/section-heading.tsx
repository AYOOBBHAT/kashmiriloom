import type { ReactNode } from "react";

type SectionHeadingProps = {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  tone?: "default" | "inverse";
  level?: "h1" | "h2";
};

export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  tone = "default",
  level = "h2",
}: SectionHeadingProps) {
  const inverse = tone === "inverse";
  const HeadingTag = level;

  return (
    <div id={id} tabIndex={-1} className="max-w-2xl scroll-mt-28 outline-none">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px w-8 bg-gold" />
        <p
          className={`text-[0.72rem] font-semibold uppercase tracking-[0.28em] ${
            inverse ? "text-ivory" : "text-burgundy"
          }`}
        >
          {eyebrow}
        </p>
      </div>
      <HeadingTag
        id={`${id}-title`}
        className={`mt-4 font-serif text-4xl leading-[1.08] text-balance sm:text-5xl ${
          inverse ? "text-ivory" : "text-forest"
        }`}
      >
        {title}
      </HeadingTag>
      {children ? (
        <div
          className={`mt-5 text-lg leading-relaxed text-pretty ${
            inverse ? "text-ivory" : "text-muted"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
