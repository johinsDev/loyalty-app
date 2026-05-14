import { FakeRealtime, RealtimeClient } from "@loyalty/realtime";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for the realtime channel in the customer PWA. Provides a
 * single `realtime` instance that satisfies `RealtimeBinding` from
 * `@loyalty/api/trpc` — bind it on `ctx.realtime` so routers publish
 * without importing this module (avoids packages/api → apps/web cycle).
 *
 * Provider selection:
 *   - Configured (HOST + PROJECT + SECRET): real `RealtimeClient`
 *     posts HMAC-signed events to PartyKit. Used in production +
 *     any preview/dev where you set the three env vars.
 *   - Otherwise: `FakeRealtime` — records publishes in memory and
 *     logs them via `@loyalty/log`. Keeps the rest of the app
 *     working when partykit isn't wired (most local dev setups).
 *
 * See `.claude/skills/realtime/SKILL.md` for the deploy flow.
 */
export const realtime =
  env.PARTYKIT_HOST && env.PARTYKIT_PROJECT && env.REALTIME_AUTH_SECRET
    ? new RealtimeClient({
        host: env.PARTYKIT_HOST,
        project: env.PARTYKIT_PROJECT,
        secret: env.REALTIME_AUTH_SECRET,
      })
    : (() => {
        log.warn(
          { _service: "realtime" },
          "realtime not configured — using FakeRealtime; set PARTYKIT_HOST + PARTYKIT_PROJECT + REALTIME_AUTH_SECRET",
        );
        return new FakeRealtime();
      })();
