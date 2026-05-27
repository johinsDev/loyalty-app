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
 * Bootstrap for `@loyalty/storage` in the customer PWA. One module,
 * imported anywhere via `import { storage } from "@/lib/storage"`.
 *
 * Provider cascade (when `STORAGE_PROVIDER` is unset):
 *   - Vercel production: `r2` (real Cloudflare R2 — required)
 *   - Vercel preview:    `r2` if keys present, else `memory` fallback
 *   - Local dev:         `local` (filesystem at `.storage/`)
 *
 * Override with `STORAGE_PROVIDER=memory|local|r2` at any time.
 *
 * See `.claude/skills/storage/SKILL.md` for the full handbook + R2
 * setup walkthrough.
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
        "STORAGE_PROVIDER=r2 but R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET are not set",
      );
    }
    const cfg: R2DiskConfig = {
      provider: "r2",
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      ...(env.R2_PUBLIC_URL && { publicUrl: env.R2_PUBLIC_URL }),
    };
    return cfg;
  }
  const baseUrl =
    env.NEXT_PUBLIC_APP_URL ?? `http://localhost:3002`;
  // Reuse the realtime HMAC secret so we don't manage two secrets.
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
