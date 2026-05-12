import { db } from "@loyalty/db";
import { WhatsAppManager, type ProviderConfig } from "@loyalty/whatsapp";

import { env } from "./env";
import { log } from "./log";

/**
 * Bootstrap for `@loyalty/whatsapp` in Trigger.dev tasks. Same policy
 * as the apps: log locally, outbox in preview, twilio in prod.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" {
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

export const whatsapp = new WhatsAppManager({
  default: pickDefaultProvider(),
  mailers: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    twilio: twilioConfig,
  },
  logger: log,
});
