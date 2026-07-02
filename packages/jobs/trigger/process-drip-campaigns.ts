import {
  CampaignsRepository,
  CampaignsService,
} from "@loyalty/api/features/campaigns";
import { getPrimaryOrganizationId, db } from "@loyalty/db";
import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Daily drip pulse. For each live drip campaign, re-insist the cohort members
 * who are due (last send ≥ interval ago), under the attempt cap, and haven't
 * purchased since their first send. Thin orchestrator — the service resolves
 * who's due and reuses the `send-campaign` job (pulse + cap bypass). Pause in
 * the Trigger.dev dashboard to disable.
 */
export const processDripCampaignsTask = schedules.task({
  id: "process-drip-campaigns",
  cron: "0 9 * * *",
  run: async () => {
    const orgId = await getPrimaryOrganizationId();
    if (!orgId) return { skipped: "no-org" as const };

    const service = new CampaignsService(db, new CampaignsRepository(db));
    const result = await service.pulseDrip(orgId);
    logger.info("process-drip-campaigns done", result);
    return result;
  },
});
