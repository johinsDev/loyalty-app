import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@loyalty/api",
    "@loyalty/auth",
    "@loyalty/db",
    "@loyalty/log",
    "@loyalty/ui",
  ],
  typedRoutes: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default config;
