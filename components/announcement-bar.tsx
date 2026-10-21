import Link from "next/link";

export function AnnouncementBar() {
  return (
    <div className="bg-forest text-ivory" role="region" aria-label="Announcement">
      <p className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2.5 text-center text-sm">
        <span>The autumn edit — Kani, embroidered, and everyday shawls.</span>
        <Link href="/shop" className="underline decoration-gold/80 underline-offset-4">
          Shop the edit
        </Link>
      </p>
    </div>
  );
}
