import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in development so HMR isn't fighting the cache.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

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

export default withSerwist(withNextIntl(config));
