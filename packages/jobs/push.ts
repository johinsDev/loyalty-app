import { PushTokenRepository } from "@loyalty/api/features/push-tokens";
import { db } from "@loyalty/db";
import {
  PushManager,
  type ProviderConfig,
  type PushPlatform,
} from "@loyalty/push";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@loyalty/push` inside Trigger.dev tasks. Mirrors the
 * shape of `apps/{web,admin}/src/lib/push.ts` — same provider cascade,
 * same `tokenLookup` for the `auto` mode that fans out web push vs
 * Expo per device.
 *
 * Defaults: log locally, outbox in preview, auto in prod.
 */
function pickDefaultProvider(): "log" | "outbox" | "webpush" | "expo" | "auto" {
  if (env.PUSH_PROVIDER) return env.PUSH_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "auto";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const tokenRepo = new PushTokenRepository(db);
async function tokenLookup(
  userId: string,
): Promise<Array<{ token: string; platform: PushPlatform }>> {
  const rows = await tokenRepo.listActiveForCustomer(
    userId,
    env.LOYALTY_ORG_ID ?? "",
  );
  return rows.map((r) => ({
    token: r.token,
    platform: r.platform as PushPlatform,
  }));
}

const webpushConfig: ProviderConfig | undefined =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
    ? {
        provider: "webpush",
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      }
    : undefined;

const expoConfig: ProviderConfig = {
  provider: "expo",
  ...(env.EXPO_ACCESS_TOKEN && { accessToken: env.EXPO_ACCESS_TOKEN }),
};

const autoConfig: ProviderConfig | undefined =
  webpushConfig?.provider === "webpush"
    ? {
        provider: "auto",
        webpush: webpushConfig,
        expo: expoConfig,
        tokenLookup,
      }
    : undefined;

export const push = new PushManager({
  default: pickDefaultProvider(),
  senders: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    webpush: webpushConfig,
    expo: expoConfig,
    auto: autoConfig,
  },
  logger: log,
});

export { tokenLookup };
