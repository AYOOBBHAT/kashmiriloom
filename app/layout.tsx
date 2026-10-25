import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import { STORE_ORIGIN } from "@/lib/site/policies";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(STORE_ORIGIN),
  title: {
    default: "KashmiriLoom — Woven in Kashmir",
    template: "%s · KashmiriLoom",
  },
  description:
    "KashmiriLoom is a house for traditional Kashmiri shawls: Kani weaves, embroidered pieces, and everyday wraps. Prices are shown in Indian rupees.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-ivory font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:bg-ivory focus:px-4 focus:py-3 focus:text-sm focus:text-forest"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
