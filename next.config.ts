import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production builds from overwriting a running dev server's assets.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

export default nextConfig;
