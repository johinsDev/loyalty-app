import { createAuth } from "@loyalty/auth/server";
import { tasks } from "@trigger.dev/sdk/v3";

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
export const auth = createAuth(
  {
    sendOtp: async ({ phoneNumber, code }) => {
      await tasks.trigger<typeof sendOtpWhatsappTask>("send-otp-whatsapp", {
        phoneNumber,
        code,
      });
      log.info({ phoneNumber }, "auth.phoneNumber.sendOtp.queued");
    },
    sendMagicLink: async ({ email, url }) => {
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
