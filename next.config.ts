import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mutable control-plane state + dashboard polling — keep pages uncached.
  cacheComponents: false,
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
