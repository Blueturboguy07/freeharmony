import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@freeharmony/engine", "@freeharmony/advice"],
  turbopack: {
    // Monorepo root — keeps a stray lockfile in $HOME from confusing detection.
    root: join(__dirname, "..", ".."),
  },
};

export default nextConfig;
