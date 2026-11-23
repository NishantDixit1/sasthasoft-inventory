import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole app is a client-side demo whose figures are relative to the
  // current date, so there is nothing worth prerendering at build time.
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
