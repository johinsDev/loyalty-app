import {
  type DiskConfig,
  type MemoryDiskConfig,
  type R2DiskConfig,
  StorageManager,
} from "@loyalty/storage";

import { env } from "./env";
import { log } from "./log";

// R2 over the S3 API when creds are present (aws-sdk is lazy-loaded on first
// use; validate it on workerd in the deploy slice — a native R2-binding path is
// a follow-up). No filesystem on Workers, so the fallback is the memory disk.
function buildDisk(): DiskConfig {
  if (
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET
  ) {
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
  const cfg: MemoryDiskConfig = {
    provider: "memory",
    baseUrl: env.STORAGE_BASE_URL ?? "http://localhost:8787",
    secret:
      env.REALTIME_AUTH_SECRET ??
      "dev-only-secret-min-32-chars-padding-padding-pad",
  };
  return cfg;
}

export const storage = new StorageManager({
  default: "default",
  disks: { default: buildDisk() },
  keyPrefix: env.STORAGE_KEY_PREFIX,
  logger: log,
});
