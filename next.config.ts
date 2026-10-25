import type { NextConfig } from "next";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
const cloudinaryHost =
  /^[a-z0-9_-]{1,64}$/i.test(cloudName)
    ? [
        {
          protocol: "https" as const,
          hostname: "res.cloudinary.com",
          pathname: `/${cloudName}/image/upload/**`,
        },
      ]
    : [];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: cloudinaryHost,
    qualities: [60, 75],
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "private, no-store" }];
    return [
      { source: "/account", headers: noStore },
      { source: "/account/:path*", headers: noStore },
      { source: "/login", headers: noStore },
      { source: "/register", headers: noStore },
      { source: "/forgot-password", headers: noStore },
      { source: "/reset-password", headers: noStore },
      { source: "/auth/callback/:path*", headers: noStore },
      { source: "/checkout", headers: noStore },
      { source: "/checkout/:path*", headers: noStore },
      { source: "/orders", headers: noStore },
      { source: "/orders/:path*", headers: noStore },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
