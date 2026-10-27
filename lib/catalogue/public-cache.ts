import "server-only";

import { revalidateTag, updateTag } from "next/cache";
import { PUBLIC_CATALOGUE_TAG } from "@/lib/catalogue/public-tag";

/** Server Actions. The next render waits for a fresh public catalogue. */
export function expirePublicCatalogue(): void {
  updateTag(PUBLIC_CATALOGUE_TAG);
}

/** Route Handlers. The previous public catalogue is not served again. */
export function revalidatePublicCatalogue(): void {
  revalidateTag(PUBLIC_CATALOGUE_TAG, { expire: 0 });
}
