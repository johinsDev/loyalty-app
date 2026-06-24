import { getPrimaryOrganizationId, db } from "@loyalty/db";
import {
  POINTS_ENABLED,
  PointsRepository,
  PointsService,
} from "@loyalty/api/features/points";
import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Daily tier recompute. A tier can drop purely because old points aged out of
 * the rolling window (no transaction fires), so this cron re-evaluates every
 * customer with points activity and emits `tier-down` (and any pending
 * near-threshold) — tier-ups already fire on-earn. Thin orchestrator; the
 * service owns the logic. Pause in the Trigger.dev dashboard to disable.
 */
export const pointsTierRecomputeTask = schedules.task({
  id: "points-tier-recompute",
  cron: "0 6 * * *",
  run: async () => {
    if (!POINTS_ENABLED) return { skipped: "disabled" as const };

    const orgId = await getPrimaryOrganizationId();
    if (!orgId) return { skipped: "no-org" as const };

    const repo = new PointsRepository(db);
    // No realtime binding in the cron (the customer's app likely isn't open);
    // the WhatsApp + feed notification carries the tier-down. enqueue defaults
    // to the Trigger.dev send-notification task.
    const service = new PointsService(repo);

    const customers = await repo.customersForRecompute(orgId);
    for (const customerId of customers) {
      await service.recompute(orgId, customerId).catch(() => {});
    }

    const result = { recomputed: customers.length };
    logger.info("points-tier-recompute done", result);
    return result;
  },
});
