import { appRouter, createContext } from "@loyalty/api";
import { auth } from "@loyalty/auth/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { log } from "./log";

/**
 * Standalone API: Hono on Cloudflare Workers serving Better Auth + the tRPC
 * `appRouter`. Phase 1 — it runs ALONGSIDE the Next.js `/api/trpc` + `/api/auth`
 * routes; nothing in the FE points here yet. Context is the lean slice (db +
 * session via the shared `createContext`, plus a console logger); the remaining
 * request bindings (analytics/flags/rate-limit/realtime/storage) land in the
 * next slice with a Workers env reader. See the API-Worker plan + skill.
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

// Better Auth — the single issuer (Google + phone-OTP + organization). The
// handler is a plain fetch handler.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// tRPC over the fetch adapter, reusing the shared `createContext` (db + session).
app.all("/trpc/*", (c) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: async () => {
      const ctx = await createContext({ headers: c.req.raw.headers });
      return { ...ctx, log };
    },
  }),
);

app.get("/", (c) => c.text("loyalty-api ok"));

export default app;
