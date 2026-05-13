import { db } from "@loyalty/db";
import { EmailManager, type ProviderConfig } from "@loyalty/email";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/email` in the customer PWA. One module,
 * imported anywhere via `import { email } from "@/lib/email"`.
 *
 * Provider selection (default if `EMAIL_PROVIDER` is unset):
 *   - local dev:        log    (lines via `@loyalty/log`, no network)
 *   - preview deploy:   outbox (rows in `email_outbox`, visible in
 *                              `/[locale]/(dev)/email-outbox`)
 *   - production:       resend (real Resend API)
 *
 * Override with `EMAIL_PROVIDER=log|folder|outbox|resend`.
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
