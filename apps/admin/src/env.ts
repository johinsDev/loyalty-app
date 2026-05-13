import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed + validated env for the admin CRM. Same shape as
 * `apps/web/env.ts` plus the admin-specific Better Auth + Google
 * OAuth fields.
 */

const whatsappProvider = z
  .enum(["log", "folder", "outbox", "twilio"])
  .optional();
const smsProvider = z.enum(["log", "folder", "outbox", "twilio"]).optional();

const requireWhen = (field: string, predicate: () => boolean, reason: string) =>
  z
    .string()
    .optional()
    .refine((v) => !predicate() || (v && v.length > 0), {
      message: `${field} is required when ${reason}`,
    });

const isWhatsAppTwilio = () => process.env.WHATSAPP_PROVIDER === "twilio";
const isSmsTwilio = () => process.env.SMS_PROVIDER === "twilio";
const isAnyTwilio = () => isWhatsAppTwilio() || isSmsTwilio();

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),

    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
    LOG_CHANNEL: z
      .enum(["pino", "console", "silent", "better-stack"])
      .optional(),

    BETTER_STACK_SOURCE_TOKEN_ADMIN: z.string().optional(),
    BETTER_STACK_INGESTING_HOST_ADMIN: z.string().optional(),
    BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    BETTER_STACK_INGESTING_HOST: z.string().optional(),

    WHATSAPP_PROVIDER: whatsappProvider,
    WHATSAPP_PREVIEW_DIR: z.string().optional(),

    SMS_PROVIDER: smsProvider,
    SMS_PREVIEW_DIR: z.string().optional(),

    TWILIO_ACCOUNT_SID: requireWhen(
      "TWILIO_ACCOUNT_SID",
      isAnyTwilio,
      "WHATSAPP_PROVIDER=twilio or SMS_PROVIDER=twilio",
    ),
    TWILIO_AUTH_TOKEN: requireWhen(
      "TWILIO_AUTH_TOKEN",
      isAnyTwilio,
      "WHATSAPP_PROVIDER=twilio or SMS_PROVIDER=twilio",
    ),
    TWILIO_WHATSAPP_FROM: requireWhen(
      "TWILIO_WHATSAPP_FROM",
      isWhatsAppTwilio,
      "WHATSAPP_PROVIDER=twilio",
    ),
    TWILIO_SMS_FROM: requireWhen(
      "TWILIO_SMS_FROM",
      isSmsTwilio,
      "SMS_PROVIDER=twilio",
    ),
  },
  client: {},
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
