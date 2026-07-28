import { createAuth } from "@loyalty/auth/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { Redis } from "@upstash/redis";

import { env } from "./env";
import { log } from "./log";

import type { sendOtpWhatsappTask } from "@loyalty/jobs/trigger/send-otp-whatsapp";

// Untyped trigger by ID — typing it against the task would pull
// `@loyalty/jobs/trigger/send-magic-link-email` (which imports the JSX
// `@loyalty/email-templates`) into the lean Worker's type graph. The payload
// stays in sync with the task definition in packages/jobs. (Same pattern as the
// push-tokens router's send-test-push.)
type SendMagicLinkPayload = { email: string; url: string };

/**
 * The Worker is the single Better Auth issuer for every FE app, so it wires
 * BOTH sign-in surfaces on one instance:
 *   - web  → phone-number OTP over WhatsApp, enqueued to Trigger.dev (the
 *            Worker just triggers the task; the actual send runs in the Node
 *            job, keeping the Worker lean).
 *   - admin → email/password (the seeded admin, preview/dev only) + passwordless
 *            magic-link (all envs; the email is enqueued to Trigger.dev too).
 *
 * `baseURL` defaults to `BETTER_AUTH_URL` inside `createAuth`, which the Worker
 * sets to its own origin (`api.t4diverclub.app` in prod, `localhost:8787` in
 * dev) so the OAuth redirect URI + cookies are minted against the API host. The
 * cross-subdomain cookie + extra trusted origins come from `createAuth` via
 * `AUTH_COOKIE_DOMAIN` / `BETTER_AUTH_TRUSTED_ORIGINS`.
 */
// Redis-backed session store (Upstash) so Better Auth's `getSession` — run on
// every request + RSC auth-guard — reads sessions from Redis instead of Turso.
// Only when creds are present (prod/preview; mirrors the cache/rate-limit
// provider selection); local/dev without Upstash falls back to DB sessions. Raw
// strings (`automaticDeserialization: false`) — Better Auth stores its own
// serialized values. Passed via deps so `@upstash/redis` never lands in the FE.
const secondaryStorage =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? ((redis) => ({
        // Wrapped in try/catch so a Redis hiccup is LOGGED, not silent: a failed
        // session read/write would otherwise bounce the user with no trace. The
        // key is a session token (secret) — never log it, only the op + error.
        get: async (key: string) => {
          try {
            return await redis.get<string>(key);
          } catch (err) {
            log.error({ err }, "auth.secondaryStorage.get.failed");
            return null;
          }
        },
        set: async (key: string, value: string, ttl?: number) => {
          try {
            if (ttl) await redis.set(key, value, { ex: ttl });
            else await redis.set(key, value);
          } catch (err) {
            // Rethrow: a dropped session write must surface, not fail silently.
            log.error({ err, ttl }, "auth.secondaryStorage.set.failed");
            throw err;
          }
        },
        delete: async (key: string) => {
          try {
            await redis.del(key);
          } catch (err) {
            log.error({ err }, "auth.secondaryStorage.delete.failed");
          }
        },
      }))(
        new Redis({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
          automaticDeserialization: false,
        }),
      )
    : undefined;

export const auth = createAuth(
  {
    secondaryStorage,
    sendOtp: async ({ phoneNumber, code }) => {
      // Local dev (no Trigger.dev): don't dispatch — log the code so it can be
      // entered from the console. Prod/preview always set TRIGGER_SECRET_KEY.
      if (!process.env.TRIGGER_SECRET_KEY) {
        log.warn(
          { phoneNumber, code },
          "auth.phoneNumber.sendOtp.devLog — TRIGGER_SECRET_KEY unset; OTP logged, not sent",
        );
        return;
      }
      await tasks.trigger<typeof sendOtpWhatsappTask>("send-otp-whatsapp", {
        phoneNumber,
        code,
      });
      log.info({ phoneNumber }, "auth.phoneNumber.sendOtp.queued");
    },
    sendMagicLink: async ({ email, url }) => {
      if (!process.env.TRIGGER_SECRET_KEY) {
        log.warn(
          { email, url },
          "auth.magicLink.send.devLog — TRIGGER_SECRET_KEY unset; magic link logged, not sent",
        );
        return;
      }
      const payload: SendMagicLinkPayload = { email, url };
      await tasks.trigger("send-magic-link-email", payload);
      log.info({ email }, "auth.magicLink.send.queued");
    },
  },
  {
    // email/password backs the seeded admin in preview/dev only
    // (AUTH_PASSWORD_ENABLED=true there, false in prod). Prod admin sign-in is
    // passwordless magic-link, which is always on (wired via sendMagicLink).
    emailAndPasswordEnabled: process.env.AUTH_PASSWORD_ENABLED === "true",
  },
);
