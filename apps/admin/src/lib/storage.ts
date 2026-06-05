import {
  StorageManager,
  type DiskConfig,
  type LocalDiskConfig,
  type MemoryDiskConfig,
  type R2DiskConfig,
} from "@loyalty/storage";

import { env } from "../env";

import { log } from "./log";

/**
 * Admin CRM bootstrap for the storage channel. Mirrors
 * `apps/web/src/lib/storage.ts`. See `.claude/skills/storage/SKILL.md`
 * for the provider cascade.
 */
function pickDefaultProvider(): "memory" | "local" | "r2" {
  if (env.STORAGE_PROVIDER) return env.STORAGE_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "r2";
  if (process.env.VERCEL_ENV === "preview") {
    return env.R2_BUCKET ? "r2" : "memory";
  }
  return "local";
}

function buildDiskConfig(): DiskConfig {
  const provider = pickDefaultProvider();
  if (provider === "r2") {
    if (
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET
    ) {
      throw new Error(
        "STORAGE_PROVIDER=r2 but R2 credentials are not set",
      );
    }
    const cfg: R2DiskConfig = {
      provider: "r2",
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      // A public bucket URL means downloads should use it (cacheable, no
      // signing); isPublic flips getDownloadUrl to the public URL.
      ...(env.R2_PUBLIC_URL && {
        publicUrl: env.R2_PUBLIC_URL,
        isPublic: true,
      }),
    };
    return cfg;
  }
  const baseUrl =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:3003`);
  const secret =
    env.REALTIME_AUTH_SECRET ?? "dev-only-secret-min-32-chars-padding-padding-pad";
  if (provider === "local") {
    const cfg: LocalDiskConfig = {
      provider: "local",
      rootDir: ".storage",
      baseUrl,
      secret,
    };
    return cfg;
  }
  const cfg: MemoryDiskConfig = {
    provider: "memory",
    baseUrl,
    secret,
  };
  return cfg;
}

export const storage = new StorageManager({
  default: "default",
  disks: {
    default: buildDiskConfig(),
  },
  // Preview sets STORAGE_KEY_PREFIX=pr-<n>/ so each PR's uploads live in their
  // own R2 folder (purged on PR close). Empty elsewhere → no-op.
  keyPrefix: env.STORAGE_KEY_PREFIX,
  logger: log,
});
