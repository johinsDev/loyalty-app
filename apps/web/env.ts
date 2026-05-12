import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed + validated env for the customer PWA. Imported by `lib/log.ts`
 * and `lib/whatsapp.ts` at module load — validation runs once, on
 * first import, and fails the boot if anything is missing or shaped
 * wrong. Replaces ad-hoc `process.env.X` reads inside bootstrap code.
 *
 * Pattern lifted from t4-app:
 *   - `<thing>Provider` zod enum with a sensible default
 *   - `<vendor>Required(field)` helper that turns the value into a
 *     conditionally-required string (required when its provider is
 *     selected; optional otherwise)
 */

const whatsappProvider = z
  .enum(["log", "folder", "outbox", "twilio"])
  .optional();

const requireWhen = (field: string, predicate: () => boolean) =>
  z
    .string()
    .optional()
    .refine((v) => !predicate() || (v && v.length > 0), {
      message: `${field} is required when WHATSAPP_PROVIDER=twilio`,
    });

const isWhatsAppTwilio = () => process.env.WHATSAPP_PROVIDER === "twilio";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),

    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
    LOG_CHANNEL: z
      .enum(["pino", "console", "silent", "better-stack"])
      .optional(),

    BETTER_STACK_SOURCE_TOKEN_WEB: z.string().optional(),
    BETTER_STACK_INGESTING_HOST_WEB: z.string().optional(),
    BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    BETTER_STACK_INGESTING_HOST: z.string().optional(),

    WHATSAPP_PROVIDER: whatsappProvider,
    TWILIO_ACCOUNT_SID: requireWhen("TWILIO_ACCOUNT_SID", isWhatsAppTwilio),
    TWILIO_AUTH_TOKEN: requireWhen("TWILIO_AUTH_TOKEN", isWhatsAppTwilio),
    TWILIO_WHATSAPP_FROM: requireWhen("TWILIO_WHATSAPP_FROM", isWhatsAppTwilio),
    WHATSAPP_PREVIEW_DIR: z.string().optional(),
    WHATSAPP_OUTBOX_ENDPOINT_ENABLED: z
      .enum(["true", "false"])
      .optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
