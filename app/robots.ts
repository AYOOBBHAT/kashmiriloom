import type { MetadataRoute } from "next";
import { PRIVATE_ROBOT_PATHS } from "@/lib/site/robots-rules";
import { absoluteUrl } from "@/lib/site/sitemap-entries";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_ROBOT_PATHS],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
