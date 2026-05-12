import { db } from "@loyalty/db";
import { WhatsAppManager, type ProviderConfig } from "@loyalty/whatsapp";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/whatsapp` in Trigger.dev tasks. Same policy
 * as the apps: log locally, outbox in preview, twilio in prod.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" {
  const explicit = process.env.WHATSAPP_PROVIDER;
  if (explicit === "log" || explicit === "outbox" || explicit === "twilio") {
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

export const whatsapp = new WhatsAppManager({
  default: pickDefaultProvider(),
  mailers: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    twilio: twilioConfig,
  },
  logger: log,
});
