import {
  AdminNotificationRepository,
  AdminNotificationService,
} from "@loyalty/api/features/admin-notifications";
import { db } from "@loyalty/db";
import { logger, schedules } from "@trigger.dev/sdk/v3";

import { env } from "../env";

/**
 * Retention for the operator inbox, 04:30 UTC.
 *
 * The inbox has no delete button on purpose — an alert is a record of
 * something that happened (a manual adjustment, a ban, an impersonation), and
 * letting whoever triggered it sweep the evidence away defeats the point.
 * Archiving takes a row out of sight; this is what eventually takes it out of
 * the table, on a clock nobody can rush.
 *
 * Only archived rows are eligible: anything still sitting in an inbox stays,
 * however old.
 */
export const pruneAdminAlertsTask = schedules.task({
  id: "prune-admin-alerts",
  cron: "30 4 * * *",
  run: async () => {
    const retentionDays = env.ADMIN_ALERT_RETENTION_DAYS ?? 90;
    const service = new AdminNotificationService(
      new AdminNotificationRepository(db),
    );
    const deleted = await service.pruneArchived(retentionDays);
    const result = { retentionDays, deleted };
    logger.info("prune-admin-alerts done", result);
    return result;
  },
});
