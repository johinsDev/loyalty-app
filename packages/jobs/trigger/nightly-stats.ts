import {
  AdminNotificationRepository,
  AdminNotificationService,
} from "@loyalty/api/features/admin-notifications";
import { db } from "@loyalty/db";
import { logger, schedules, tasks } from "@trigger.dev/sdk/v3";

/**
 * Daily close, 03:00 UTC.
 *
 * This is the other half of the alert catalog's noise policy: events marked
 * `digest` (new signups) and adjustments that fell under their threshold never
 * raise their own inbox row, so without this they'd be invisible. One summary
 * a day keeps them countable without making the bell useless.
 *
 * The window is the previous UTC day, matching the cron.
 */
export const nightlyStatsTask = schedules.task({
  id: "nightly-stats",
  cron: "0 3 * * *",
  run: async (payload) => {
    const to = startOfUtcDay(payload.timestamp);
    const from = new Date(to.getTime() - 86_400_000);

    const service = new AdminNotificationService(
      new AdminNotificationRepository(db),
    );
    const orgIds = await service.listOrganizationIds();

    const results: Array<{ organizationId: string; sent: boolean }> = [];
    // oxlint-disable no-await-in-loop -- one org per iteration; the pilot has
    // one, and serialising keeps the DB round trips predictable.
    for (const organizationId of orgIds) {
      const counts = await service.digestCounts(organizationId, from, to);
      // Nothing happened — don't send a digest saying nothing happened.
      const quiet =
        counts.signups === 0 &&
        counts.purchases === 0 &&
        counts.redemptions === 0 &&
        counts.adjustments === 0;
      if (quiet) {
        results.push({ organizationId, sent: false });
        continue;
      }
      await tasks
        .trigger("send-admin-alert", {
          organizationId,
          alertType: "daily-digest",
          payload: { ...counts, from: from.toISOString(), to: to.toISOString() },
        })
        .catch(() => {});
      results.push({ organizationId, sent: true });
    }

    const output = {
      from: from.toISOString(),
      to: to.toISOString(),
      organizations: results.length,
      sent: results.filter((r) => r.sent).length,
    };
    logger.info("nightly-stats done", output);
    return output;
  },
});

function startOfUtcDay(at: Date): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
}
