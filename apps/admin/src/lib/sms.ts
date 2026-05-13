import { db } from "@loyalty/db";
import { SmsManager, type ProviderConfig } from "@loyalty/sms";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/sms` in the staff CRM. Mirror of the web
 * app's bootstrap; see `apps/web/src/lib/sms.ts` for the cascade.
 */
function pickDefaultProvider(): "log" | "outbox" | "twilio" | "folder" {
  if (env.SMS_PROVIDER) return env.SMS_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "twilio";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const twilioConfig: ProviderConfig | undefined =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM
    ? {
        provider: "twilio",
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        from: env.TWILIO_SMS_FROM,
      }
    : undefined;

const folderConfig: ProviderConfig | undefined = env.SMS_PREVIEW_DIR
  ? { provider: "folder", outputDir: env.SMS_PREVIEW_DIR }
  : undefined;

export const sms = new SmsManager({
  default: pickDefaultProvider(),
  mailers: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    twilio: twilioConfig,
    folder: folderConfig,
  },
  logger: log,
});
