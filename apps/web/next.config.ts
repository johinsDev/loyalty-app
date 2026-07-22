import path from "node:path";

import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in development so HMR isn't fighting the cache.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
  // @loyalty/{rate-limit,cache} default to the upstash provider in preview +
  // prod and load @upstash/* through the `new Function` import in their
  // `_lazy.ts` — opaque to @vercel/nft, so the SDK (though installed) never
  // lands in the serverless function and throws MissingDependencyError at
  // runtime. Force-include it. The other serverExternalPackages providers
  // default to log/memory in preview and are never loaded, so they don't need
  // this. outputFileTracingRoot points at the monorepo root so the hoisted
  // packages (above this app dir) are includable.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/@upstash/**/*",
      "../../node_modules/uncrypto/**/*",
    ],
  },
  transpilePackages: [
    "@loyalty/api",
    "@loyalty/auth",
    "@loyalty/log",
    "@loyalty/ui",
  ],
  // Provider deps loaded via `await import(...)` in
  // @loyalty/{push,sms,whatsapp,cache,rate-limit,email,storage}; mark external
  // so the bundler doesn't try to resolve them and they're required from
  // node_modules at runtime (the lazy `new Function` import hides them from nft).
  serverExternalPackages: [
    "web-push",
    "expo-server-sdk",
    "twilio",
    "ioredis",
    "@upstash/redis",
    "@upstash/ratelimit",
    "resend",
  ],
  typedRoutes: true,
  // Custom loader gates Cloudflare Image Transformations on
  // `NEXT_PUBLIC_IMAGE_CDN_HOST`. When unset (dev + previews) the loader is
  // a no-op and Next renders the raw src. See
  // `.claude/skills/image-loader/SKILL.md`.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.t4diverclub.app" },
      // Demo placeholder host — swap out when real R2-backed brand assets land.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

// Sentry wraps outermost (over Serwist + next-intl). Source maps upload during
// `next build` only when ORG/PROJECT/AUTH_TOKEN are present (preview + prod via
// Infisical); unset (local dev) → upload is skipped, the SDK still no-ops on a
// missing DSN. `tunnelRoute` proxies browser events through a same-origin path
// to dodge ad blockers — excluded from the proxy matcher in `proxy.ts`. See
// `.claude/skills/sentry/SKILL.md`.
export default withSentryConfig(withSerwist(withNextIntl(config)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  webpack: { treeshake: { removeDebugLogging: true } },
  widenClientFileUpload: true,
});
