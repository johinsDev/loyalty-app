import { db } from "@loyalty/db";
import { WhatsAppManager, type ProviderConfig } from "@loyalty/whatsapp";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/whatsapp` in the admin app. Same shape as
 * `apps/web/lib/whatsapp.ts`. See that file's comment for the
 * provider-per-env policy.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" | "folder" {
  const explicit = process.env.WHATSAPP_PROVIDER;
  if (
    explicit === "log" ||
    explicit === "outbox" ||
    explicit === "twilio" ||
    explicit === "folder"
  ) {
    return explicit;
  }
  if (process.env.VERCEL_ENV === "production") return "twilio";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const twilioConfig: ProviderConfig | undefined =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_WHATSAPP_FROM
    ? {
        provider: "twilio",
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      }
    : undefined;

const folderConfig: ProviderConfig | undefined = process.env.WHATSAPP_PREVIEW_DIR
  ? { provider: "folder", outputDir: process.env.WHATSAPP_PREVIEW_DIR }
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
