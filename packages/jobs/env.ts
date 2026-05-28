import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Typed + validated env for Trigger.dev tasks. Runtime is Node (not
 * Next.js), so this uses `@t3-oss/env-core` and reads from
 * `process.env` directly.
 *
 * Lazy: validation runs on first access of `env.X`, not at import. Tasks read
 * env inside their `run()` (where the full env is present), so importing this
 * module during `trigger deploy` indexing — which bundles task files in a
 * sandbox with no env — doesn't throw.
 */

const whatsappProvider = z.enum(["log", "outbox", "twilio"]).optional();

const pushProvider = z
  .enum(["log", "outbox", "webpush", "expo", "auto"])
  .optional();

const requireWhen = (field: string, predicate: () => boolean, reason: string) =>
  z
    .string()
    .optional()
    .refine((v) => !predicate() || (v && v.length > 0), {
      message: `${field} is required when ${reason}`,
    });

const isWhatsAppTwilio = () => process.env.WHATSAPP_PROVIDER === "twilio";
const isPushWebOrAuto = () =>
  ["webpush", "auto"].includes(process.env.PUSH_PROVIDER ?? "");

function build() {
  return createEnv({
    server: {
      DATABASE_URL: z.string().min(1),
      TURSO_AUTH_TOKEN: z.string().optional(),

      // Deploy/config-time only: read directly via `process.env` in
      // trigger.config.ts (which also hardcodes a fallback ref). It is NOT
      // synced into the deployed task runtime (syncEnvVars), and no task reads
      // it — so a running task in a preview-branch deployment won't have it.
      // Keep it optional or the env validation throws inside `run()`.
      TRIGGER_PROJECT_ID: z.string().optional(),
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
      TWILIO_ACCOUNT_SID: requireWhen(
        "TWILIO_ACCOUNT_SID",
        isWhatsAppTwilio,
        "WHATSAPP_PROVIDER=twilio",
      ),
      TWILIO_AUTH_TOKEN: requireWhen(
        "TWILIO_AUTH_TOKEN",
        isWhatsAppTwilio,
        "WHATSAPP_PROVIDER=twilio",
      ),
      TWILIO_WHATSAPP_FROM: requireWhen(
        "TWILIO_WHATSAPP_FROM",
        isWhatsAppTwilio,
        "WHATSAPP_PROVIDER=twilio",
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

      OUTBOX_RETENTION_DAYS: z.coerce.number().int().min(1).optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  });
}

let cached: ReturnType<typeof build> | undefined;

export const env = new Proxy({} as ReturnType<typeof build>, {
  get(_target, prop) {
    cached ??= build();
    return cached[prop as keyof typeof cached];
  },
});
