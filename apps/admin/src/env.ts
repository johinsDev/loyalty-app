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
const cacheProvider = z.enum(["memory", "upstash", "redis"]).optional();
const emailProvider = z.enum(["log", "folder", "outbox", "resend"]).optional();
const pushProvider = z
  .enum(["log", "outbox", "webpush", "expo", "auto"])
  .optional();

const isRealtimeEnabled = () =>
  !!(process.env.PARTYKIT_HOST && process.env.PARTYKIT_PROJECT);

const storageProvider = z.enum(["memory", "local", "r2"]).optional();
const isStorageR2 = () => process.env.STORAGE_PROVIDER === "r2";

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
const isCacheUpstash = () => process.env.CACHE_PROVIDER === "upstash";
const isCacheRedis = () => process.env.CACHE_PROVIDER === "redis";
const isEmailResend = () => process.env.EMAIL_PROVIDER === "resend";
const isPushWebOrAuto = () =>
  ["webpush", "auto"].includes(process.env.PUSH_PROVIDER ?? "");

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().optional(),

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
    WHATSAPP_OUTBOX_ENDPOINT_ENABLED: z
      .enum(["true", "false"])
      .optional(),

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

    CACHE_PROVIDER: cacheProvider,
    UPSTASH_REDIS_REST_URL: requireWhen(
      "UPSTASH_REDIS_REST_URL",
      isCacheUpstash,
      "CACHE_PROVIDER=upstash",
    ),
    UPSTASH_REDIS_REST_TOKEN: requireWhen(
      "UPSTASH_REDIS_REST_TOKEN",
      isCacheUpstash,
      "CACHE_PROVIDER=upstash",
    ),
    REDIS_URL: requireWhen(
      "REDIS_URL",
      isCacheRedis,
      "CACHE_PROVIDER=redis",
    ),

    EMAIL_PROVIDER: emailProvider,
    EMAIL_PREVIEW_DIR: z.string().optional(),
    EMAIL_FROM: requireWhen(
      "EMAIL_FROM",
      isEmailResend,
      "EMAIL_PROVIDER=resend",
    ),
    RESEND_API_KEY: requireWhen(
      "RESEND_API_KEY",
      isEmailResend,
      "EMAIL_PROVIDER=resend",
    ),

    PUSH_PROVIDER: pushProvider,
    VAPID_PUBLIC_KEY: requireWhen(
      "VAPID_PUBLIC_KEY",
      isPushWebOrAuto,
      "PUSH_PROVIDER=webpush or auto",
    ),
    VAPID_PRIVATE_KEY: requireWhen(
      "VAPID_PRIVATE_KEY",
      isPushWebOrAuto,
      "PUSH_PROVIDER=webpush or auto",
    ),
    VAPID_SUBJECT: requireWhen(
      "VAPID_SUBJECT",
      isPushWebOrAuto,
      "PUSH_PROVIDER=webpush or auto",
    ),
    EXPO_ACCESS_TOKEN: z.string().optional(),

    LOYALTY_ORG_ID: z.string().optional(),

    PARTYKIT_HOST: z.string().optional(),
    PARTYKIT_PROJECT: z.string().optional(),
    REALTIME_AUTH_SECRET: requireWhen(
      "REALTIME_AUTH_SECRET",
      isRealtimeEnabled,
      "PARTYKIT_HOST + PARTYKIT_PROJECT are set",
    ),

    STORAGE_PROVIDER: storageProvider,
    // Preview: per-PR namespacing for object storage + cache.
    STORAGE_KEY_PREFIX: z.string().optional(),
    CACHE_KEY_PREFIX: z.string().optional(),
    CACHE_DEFAULT_TTL: z.coerce.number().int().positive().optional(),
    R2_ACCOUNT_ID: requireWhen("R2_ACCOUNT_ID", isStorageR2, "STORAGE_PROVIDER=r2"),
    R2_ACCESS_KEY_ID: requireWhen("R2_ACCESS_KEY_ID", isStorageR2, "STORAGE_PROVIDER=r2"),
    R2_SECRET_ACCESS_KEY: requireWhen("R2_SECRET_ACCESS_KEY", isStorageR2, "STORAGE_PROVIDER=r2"),
    R2_BUCKET: requireWhen("R2_BUCKET", isStorageR2, "STORAGE_PROVIDER=r2"),
    R2_PUBLIC_URL: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_PARTYKIT_HOST: z.string().optional(),
  },
  experimental__runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PARTYKIT_HOST: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
  },
  emptyStringAsUndefined: true,
});
