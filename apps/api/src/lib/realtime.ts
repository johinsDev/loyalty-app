import { FakeRealtime, RealtimeClient } from "@loyalty/realtime";

import { env } from "./env";
import { log } from "./log";

// Publishes to PartyKit via signed fetch (Workers-safe — no SDK). Falls back to
// FakeRealtime (no-op) when unconfigured.
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
          "realtime not configured — using FakeRealtime",
        );
        return new FakeRealtime();
      })();
