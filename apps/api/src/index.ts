import {
  appRouter,
  baseProperties,
  createContext,
  resolveDistinctId,
} from "@loyalty/api";
import * as Sentry from "@sentry/cloudflare";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { analytics } from "./lib/analytics";
import { auth } from "./lib/auth";
import { env } from "./lib/env";
import { flags } from "./lib/feature-flags";
import { log } from "./lib/log";
import { rateLimiter } from "./lib/rate-limit";
import { realtime } from "./lib/realtime";
import { captureError } from "./lib/sentry";
import { transformImage } from "./lib/images";
import { storage } from "./lib/storage";

/**
 * Standalone API: Hono on Cloudflare Workers serving Better Auth + the tRPC
 * `appRouter`. Phase 1 — it runs ALONGSIDE the Next.js `/api/trpc` + `/api/auth`
 * routes; nothing in the FE points here yet. The per-request context mirrors the
 * Next route handlers (`apps/{web,admin}/app/api/trpc/[trpc]/route.ts`): the
 * shared `createContext` (db + session) plus the lean bindings. Heavy sends
 * (Twilio/web-push) stay in Trigger.dev jobs. See the API-Worker plan + skill.
 */
const app = new Hono();

// Allowed browser origins for credentialed CORS: the FE subdomains from
// BETTER_AUTH_TRUSTED_ORIGINS (admin./app.t4diverclub.app, per-PR preview hosts)
// plus localhost for `bun run dev`. Server-to-server callers (RSC → Worker) send
// no Origin and don't need CORS. Mirrors Better Auth's trustedOrigins.
const allowedOrigins = new Set(
  [
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
    "http://localhost:3002",
    "http://localhost:3003",
  ]
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(
  "*",
  cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
    credentials: true,
  }),
);

// Better Auth — the single issuer (Google + phone-OTP + organization).
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// tRPC over the fetch adapter, rebuilding the same context the Next handlers do.
app.all("/trpc/*", (c) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: async () => {
      const ctx = await createContext({ headers: c.req.raw.headers });
      const distinctId = resolveDistinctId(ctx);
      return {
        ...ctx,
        realtime,
        storage,
        rateLimiter,
        analytics: analytics.forRequest({
          distinctId,
          baseProperties: baseProperties(ctx, "api"),
        }),
        flags: flags.forRequest({ distinctId }),
        log,
        captureError,
      };
    },
  }),
);

// HTTP side of the storage presigned URLs. Only active when the disk's
// provider serves them (memory in dev/preview-without-R2); r2 presigns
// straight to the bucket, so these 404 in prod and are never hit.
app.put("/api/storage/upload", (c) => storage.handleSignedUpload(c.req.raw));
app.get("/api/storage/serve", (c) => storage.handleSignedServe(c.req.raw));

// Image transforms: resize + webp/avif R2 images via the Worker's `cf.image`
// (the URL-form `/cdn-cgi/image/` doesn't engage on our R2-native custom
// domain, and the Origin-Rule workaround needs a higher CF plan). Public images
// only for now; protected images add a session gate + a signed source later.
app.get("/img/*", (c) =>
  env.R2_PUBLIC_URL
    ? transformImage(c.req.raw, { publicUrlBase: env.R2_PUBLIC_URL })
    : c.notFound(),
);

app.get("/", (c) => c.text("loyalty-api ok"));

// Wrap the handler with Sentry (@sentry/cloudflare) — initialises per request
// (Workers have no global init) + auto-captures unhandled errors, and makes
// `Sentry.captureException` (the tRPC error hook in lib/sentry) report within the
// request scope. Inert when SENTRY_DSN is unset (errors then only log).
export default Sentry.withSentry(
  () => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0,
    ...(env.SENTRY_ENVIRONMENT && { environment: env.SENTRY_ENVIRONMENT }),
  }),
  app,
);
