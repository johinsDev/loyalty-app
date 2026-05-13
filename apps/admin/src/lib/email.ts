import { db } from "@loyalty/db";
import { EmailManager, type ProviderConfig } from "@loyalty/email";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/email` in the staff CRM. Mirror of the web
 * app's bootstrap; see `apps/web/src/lib/email.ts` for the cascade.
 */
function pickDefaultProvider(): "log" | "outbox" | "resend" | "folder" {
  if (env.EMAIL_PROVIDER) return env.EMAIL_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "resend";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const resendConfig: ProviderConfig | undefined = env.RESEND_API_KEY
  ? {
      provider: "resend",
      apiKey: env.RESEND_API_KEY,
      ...(env.EMAIL_FROM && { from: env.EMAIL_FROM }),
    }
  : undefined;

const folderConfig: ProviderConfig | undefined = env.EMAIL_PREVIEW_DIR
  ? { provider: "folder", outputDir: env.EMAIL_PREVIEW_DIR }
  : undefined;

export const email = new EmailManager({
  default: pickDefaultProvider(),
  mailers: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    resend: resendConfig,
    folder: folderConfig,
  },
  logger: log,
});
