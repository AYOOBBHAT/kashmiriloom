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
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
