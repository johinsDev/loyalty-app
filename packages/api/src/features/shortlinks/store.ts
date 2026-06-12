import type { ShortlinkStore } from "@loyalty/shortlinks";

import type { ShortlinkRepository } from "./repository";

/**
 * Adapt the Drizzle repository to the `@loyalty/shortlinks`
 * `ShortlinkStore` port, so the `custom` provider (send-time `shorten()`
 * in jobs) persists through the same table the redirect + admin read.
 */
export function createShortlinkStore(repo: ShortlinkRepository): ShortlinkStore {
  return {
    findActiveByTarget: (organizationId, targetUrl) =>
      repo.findActiveByTarget(organizationId, targetUrl),
    slugExists: (slug) => repo.slugExists(slug),
    create: async (input) => {
      const row = await repo.create(input);
      return { slug: row.slug };
    },
  };
}
