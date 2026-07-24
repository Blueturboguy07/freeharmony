import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@freeharmony/engine", "@freeharmony/advice"],
};

export default nextConfig;
