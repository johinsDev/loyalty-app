import { db } from "@loyalty/db";
import { WhatsAppManager, type ProviderConfig } from "@loyalty/whatsapp";

import { env } from "../env";
import { log } from "./log";

/**
 * Bootstrap for `@loyalty/whatsapp` in the admin app. Same shape as
 * `apps/web/lib/whatsapp.ts` — provider-per-env policy lives there;
 * env validation runs in `env.ts` at first import.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" | "folder" {
  if (env.WHATSAPP_PROVIDER) return env.WHATSAPP_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "twilio";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const twilioConfig: ProviderConfig | undefined =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM
    ? {
        provider: "twilio",
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      }
    : undefined;

const folderConfig: ProviderConfig | undefined = env.WHATSAPP_PREVIEW_DIR
  ? { provider: "folder", outputDir: env.WHATSAPP_PREVIEW_DIR }
  : undefined;

export const whatsapp = new WhatsAppManager({
  default: pickDefaultProvider(),
  mailers: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    twilio: twilioConfig,
    folder: folderConfig,
  },
  logger: log,
});
