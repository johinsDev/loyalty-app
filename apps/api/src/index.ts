import {
  appRouter,
  baseProperties,
  createContext,
  resolveDistinctId,
} from "@loyalty/api";
import { auth } from "@loyalty/auth/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { analytics } from "./lib/analytics";
import { flags } from "./lib/feature-flags";
import { log } from "./lib/log";
import { rateLimiter } from "./lib/rate-limit";
import { realtime } from "./lib/realtime";
import { captureError } from "./lib/sentry";
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

// CORS: Phase-1 reflects the request origin with credentials so a browser can
// be pointed here for testing. The cutover tightens this to the Better Auth
// trustedOrigins (the FE subdomains).
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
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

app.get("/", (c) => c.text("loyalty-api ok"));

export default app;
