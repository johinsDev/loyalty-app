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
  // Optional provider deps are loaded lazily via `await import(...)` in
  // @loyalty/{push,sms,whatsapp,cache,email,storage}. Mark them external
  // so the dev bundler doesn't try to resolve them at build time when
  // they're not the selected provider. (Same fix as packages/jobs'
  // trigger.config.ts build.external.)
  serverExternalPackages: [
    "web-push",
    "expo-server-sdk",
    "twilio",
    "ioredis",
    "@upstash/redis",
    "resend",
  ],
  typedRoutes: true,
};

export default withNextIntl(config);
