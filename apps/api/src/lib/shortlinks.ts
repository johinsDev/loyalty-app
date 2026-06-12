import { createShortlinkStore, ShortlinkRepository } from "@loyalty/api";
import { db } from "@loyalty/db";
import { ShortlinksManager } from "@loyalty/shortlinks";

import { env } from "./env";
import { log } from "./log";

// Repository for the redirect endpoint (findActiveBySlug + recordClick) and the
// admin reads (list/get/analytics). The Worker reads/writes the same `shortlink`
// table the manager's `custom` provider writes to.
export const shortlinkRepository = new ShortlinkRepository(db);

// Manager for the admin `create` path — always `custom` (the Worker serves real
// links). Slug-gen + dedupe live in the provider; bound on ctx as `shortlinks`.
// `baseUrl` here is irrelevant: the router discards the manager's returned URL
// and rebuilds it from the request host (`ctx.shortlinkBaseUrl`, set in
// createContext), so the short link always matches the Worker's actual origin.
export const shortlinks = new ShortlinksManager({
  default: "custom",
  providers: {
    custom: {
      provider: "custom",
      store: createShortlinkStore(shortlinkRepository),
      baseUrl: env.SHORTLINK_BASE_URL ?? "",
      logger: log,
    },
  },
});
