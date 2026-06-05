import {
  type DiskConfig,
  type MemoryDiskConfig,
  type R2DiskConfig,
  StorageManager,
} from "@loyalty/storage";

import { env } from "./env";
import { log } from "./log";

// R2 via the `fetch` driver (aws4fetch — pure Web Crypto + fetch, Workers-safe)
// when creds are present. The aws-sdk driver can't run on workerd (its dynamic
// import is code-generation-from-string, which workerd forbids), so the Worker
// MUST use `fetch`. No filesystem on Workers, so the fallback is the memory disk.
function buildDisk(): DiskConfig {
  if (
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET
  ) {
    const cfg: R2DiskConfig = {
      provider: "r2",
      driver: "fetch",
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
