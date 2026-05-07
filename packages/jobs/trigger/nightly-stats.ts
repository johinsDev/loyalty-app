import { logger, schedules } from "@trigger.dev/sdk/v3";

// Placeholder cron — runs daily at 03:00 UTC.
// TODO: aggregate per-organization stats (active customers, stamps, redemptions)
// and persist a daily snapshot for the dashboard.
export const nightlyStatsTask = schedules.task({
  id: "nightly-stats",
  cron: "0 3 * * *",
  run: async () => {
    logger.info("nightly-stats placeholder ran");
    return { ok: true };
  },
});
