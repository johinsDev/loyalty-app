import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Typed + validated env for Trigger.dev tasks. Runtime is Node (not
 * Next.js), so this uses `@t3-oss/env-core` and reads from
 * `process.env` directly.
 */

const whatsappProvider = z
  .enum(["log", "outbox", "twilio"])
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

    TRIGGER_PROJECT_ID: z.string().min(1),
    TRIGGER_SECRET_KEY: z.string().optional(),

    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
    LOG_CHANNEL: z
      .enum(["pino", "console", "silent", "better-stack"])
      .optional(),

    BETTER_STACK_SOURCE_TOKEN_JOBS: z.string().optional(),
    BETTER_STACK_INGESTING_HOST_JOBS: z.string().optional(),
    BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    BETTER_STACK_INGESTING_HOST: z.string().optional(),

    WHATSAPP_PROVIDER: whatsappProvider,
    TWILIO_ACCOUNT_SID: requireWhen("TWILIO_ACCOUNT_SID", isWhatsAppTwilio),
    TWILIO_AUTH_TOKEN: requireWhen("TWILIO_AUTH_TOKEN", isWhatsAppTwilio),
    TWILIO_WHATSAPP_FROM: requireWhen("TWILIO_WHATSAPP_FROM", isWhatsAppTwilio),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
