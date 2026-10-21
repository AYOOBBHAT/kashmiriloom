import { Suspense, type ReactNode } from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { BagProvider } from "@/components/bag-provider";
import { HashFocus } from "@/components/hash-focus";
import { HeaderCatalogue } from "@/components/header-catalogue";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HashFocus />
      <BagProvider>
        <AnnouncementBar />
        <Suspense fallback={<SiteHeader />}>
          <HeaderCatalogue />
        </Suspense>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </BagProvider>
    </>
  );
}
