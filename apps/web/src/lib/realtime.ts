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
// Local PartyKit serves plain HTTP; production is HTTPS. RealtimeClient
// defaults to `https`, which silently hangs the publisher for ~10s when
// pointed at `127.0.0.1` and you wonder why publishHello times out.
const isLocalHost = (host: string | undefined) =>
  !!host && /^(127\.0\.0\.1|localhost)(:|$)/.test(host);

export const realtime =
  env.PARTYKIT_HOST && env.PARTYKIT_PROJECT && env.REALTIME_AUTH_SECRET
    ? new RealtimeClient({
        host: env.PARTYKIT_HOST,
        project: env.PARTYKIT_PROJECT,
        secret: env.REALTIME_AUTH_SECRET,
        protocol: isLocalHost(env.PARTYKIT_HOST) ? "http" : "https",
        roomPrefix: env.REALTIME_ROOM_PREFIX,
      })
    : (() => {
        log.warn(
          { _service: "realtime" },
          "realtime not configured — using FakeRealtime; set PARTYKIT_HOST + PARTYKIT_PROJECT + REALTIME_AUTH_SECRET",
        );
        return new FakeRealtime();
      })();
