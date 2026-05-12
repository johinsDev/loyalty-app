import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
};

export default withNextIntl(config);
