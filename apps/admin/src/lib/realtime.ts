import { FakeRealtime, RealtimeClient } from "@loyalty/realtime";

import { env } from "../env";

import { log } from "./log";

/**
 * Admin CRM bootstrap for the realtime channel. Mirrors
 * `apps/web/src/lib/realtime.ts`. The admin uses it to publish events
 * triggered by staff actions (e.g. cashier adds a stamp → realtime
 * event fans out to the customer's connected devices).
 */
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
