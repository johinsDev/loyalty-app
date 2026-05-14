import { PushTokenRepository } from "@loyalty/api/features/push-tokens";
import { db } from "@loyalty/db";
import {
  PushManager,
  type ProviderConfig,
  type PushPlatform,
} from "@loyalty/push";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/push` in the customer PWA. One module,
 * imported anywhere via `import { push } from "@/lib/push"`.
 *
 * Provider selection (default if `PUSH_PROVIDER` is unset):
 *   - local dev:        log    (lines via `@loyalty/log`, no network)
 *   - preview deploy:   outbox (rows in `push_outbox`, visible in
 *                              `/[locale]/(dev)/push-outbox`)
 *   - production:       auto   (fans out per stored token's platform)
 *
 * Override with `PUSH_PROVIDER=log|outbox|webpush|expo|auto`. When
 * VAPID keys are missing, `webpush` + `auto` are not registered —
 * tRPC `pushTokens.register` for webpush rows will still work, but
 * the `auto` sender won't appear in the manager.
 */
function pickDefaultProvider(): "log" | "outbox" | "webpush" | "expo" | "auto" {
  if (env.PUSH_PROVIDER) return env.PUSH_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "auto";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

/**
 * Server-side token lookup for the `auto` sender. Hits Postgres
 * directly via the repository — no tRPC round-trip needed since we
 * already run in the same process.
 */
const tokenRepo = new PushTokenRepository(db);
async function tokenLookup(
  userId: string,
): Promise<Array<{ token: string; platform: PushPlatform }>> {
  // `userId` here is the loyalty `customer.id`. Callers pass the
  // customer id (not session.user.id) since the push_tokens table is
  // scoped by customer + org.
  const rows = await tokenRepo.listActiveForCustomer(
    userId,
    process.env.LOYALTY_ORG_ID ?? "",
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
