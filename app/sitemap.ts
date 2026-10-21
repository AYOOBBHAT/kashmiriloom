import type { MetadataRoute } from "next";
import { loadPublicSitemap } from "@/lib/site/sitemap-data";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return loadPublicSitemap();
}
