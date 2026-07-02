import {
  CampaignsRepository,
  CampaignsService,
} from "@loyalty/api/features/campaigns";
import { getPrimaryOrganizationId, db } from "@loyalty/db";
import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Daily evergreen pulse. For each live evergreen campaign, dispatch to the
 * currently-eligible slice (audience matchers past their per-campaign cooldown).
 * Thin orchestrator — the service resolves eligibility and reuses the
 * `send-campaign` job (with `pulse: true`, so the campaign stays "active").
 * Pause in the Trigger.dev dashboard to disable.
 */
export const processEvergreenCampaignsTask = schedules.task({
  id: "process-evergreen-campaigns",
  cron: "0 8 * * *",
  run: async () => {
    const orgId = await getPrimaryOrganizationId();
    if (!orgId) return { skipped: "no-org" as const };

    const service = new CampaignsService(db, new CampaignsRepository(db));
    const result = await service.pulseEvergreen(orgId);
    logger.info("process-evergreen-campaigns done", result);
    return result;
  },
});
