import { createShortlinkStore, ShortlinkRepository } from "@loyalty/api";
import { db } from "@loyalty/db";
import { ShortlinksManager } from "@loyalty/shortlinks";

import { env } from "./env";
import { log } from "./log";

// Repository for the redirect endpoint (findActiveBySlug + recordClick) and the
// admin reads (list/get/analytics). The Worker reads/writes the same `shortlink`
// table the manager's `custom` provider writes to.
export const shortlinkRepository = new ShortlinkRepository(db);

// Short host base URL (includes the `/r` path). Falls back to the local Worker
// in dev so manual creates + redirects work without the prod short host.
export const shortlinkBaseUrl =
  env.SHORTLINK_BASE_URL ?? "http://localhost:8787/r";

// Manager for the admin `create` path — always `custom` (the Worker serves real
// links). Slug-gen + dedupe live in the provider; bound on ctx as `shortlinks`.
export const shortlinks = new ShortlinksManager({
  default: "custom",
  providers: {
    custom: {
      provider: "custom",
      store: createShortlinkStore(shortlinkRepository),
      baseUrl: shortlinkBaseUrl,
      logger: log,
    },
  },
});
