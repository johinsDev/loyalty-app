import { db } from "@loyalty/db";
import { WhatsAppManager, type ProviderConfig } from "@loyalty/whatsapp";

import { env } from "../env";
import { log } from "./log";

/**
 * Bootstrap for `@loyalty/whatsapp` in the customer PWA. One module,
 * imports anywhere via `import { whatsapp } from "@/lib/whatsapp"`.
 *
 * Provider selection (default if `WHATSAPP_PROVIDER` is unset):
 *   - local dev:        log    (lines via `@loyalty/log`)
 *   - preview deploy:   outbox (rows in `whatsapp_outbox`)
 *   - production:       twilio (real Twilio API)
 *
 * Importing this module triggers `env.ts` validation as a side effect,
 * so missing / mis-shaped vars fail the boot before any send is tried.
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
