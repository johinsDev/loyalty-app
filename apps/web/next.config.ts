import path from "node:path";

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
    "@loyalty/db",
    "@loyalty/log",
    "@loyalty/ui",
  ],
  // `@libsql/client` (the Turso driver) ships native bindings, so it must
  // be required from node_modules at runtime, not bundled — otherwise the
  // server chunk fails with "Cannot find module '@libsql/client-<hash>'".
  // The rest are provider deps loaded via `await import(...)` in
  // @loyalty/{push,sms,whatsapp,cache,rate-limit,email,storage}; mark external
  // so the bundler doesn't try to resolve them and they're required from
  // node_modules at runtime (the lazy `new Function` import hides them from nft).
  serverExternalPackages: [
    "@libsql/client",
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

export default withSerwist(withNextIntl(config));
