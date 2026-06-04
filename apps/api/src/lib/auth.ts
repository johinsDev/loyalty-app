import { createAuth } from "@loyalty/auth/server";
import { tasks } from "@trigger.dev/sdk/v3";

import { log } from "./log";

import type { sendOtpWhatsappTask } from "@loyalty/jobs/trigger/send-otp-whatsapp";

/**
 * The Worker is the single Better Auth issuer for every FE app, so it wires
 * BOTH sign-in surfaces on one instance:
 *   - web  → phone-number OTP over WhatsApp, enqueued to Trigger.dev (the
 *            Worker just triggers the task; the actual send runs in the Node
 *            job, keeping the Worker lean).
 *   - admin → Google OAuth + env-gated email/password (preview/dev only).
 *
 * `baseURL` defaults to `BETTER_AUTH_URL` inside `createAuth`, which the Worker
 * sets to its own origin (`api.t4diverclub.app` in prod, `localhost:8787` in
 * dev) so the OAuth redirect URI + cookies are minted against the API host. The
 * cross-subdomain cookie + extra trusted origins come from `createAuth` via
 * `AUTH_COOKIE_DOMAIN` / `BETTER_AUTH_TRUSTED_ORIGINS`.
 */
export const auth = createAuth(
  {
    sendOtp: async ({ phoneNumber, code }) => {
      await tasks.trigger<typeof sendOtpWhatsappTask>("send-otp-whatsapp", {
        phoneNumber,
        code,
      });
      log.info({ phoneNumber }, "auth.phoneNumber.sendOtp.queued");
    },
  },
  {
    // Google-only by policy in prod; preview/dev set AUTH_PASSWORD_ENABLED=true
    // so the seeded preview admin + local email/password sign-in work.
    emailAndPasswordEnabled: process.env.AUTH_PASSWORD_ENABLED === "true",
  },
);
