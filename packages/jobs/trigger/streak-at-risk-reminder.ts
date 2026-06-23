import { getPrimaryOrganizationId, db } from "@loyalty/db";
import {
  closeTimeFor,
  localDay,
  mostRecentPassedOpenDay,
  REMINDER_ENABLED,
  REMINDER_HOURS_BEFORE,
  StreaksRepository,
} from "@loyalty/api/features/streaks";
import { logger, schedules, tasks } from "@trigger.dev/sdk/v3";

const HOUR_MS = 3_600_000;

/**
 * Hourly "you're about to lose your streak" nudge. Runs every hour; only the
 * hour(s) inside [close − REMINDER_HOURS_BEFORE, close] (store time) do work.
 * Targets customers with a live streak (≥1) who bought the last open day but not
 * today, once per day (dedupe via `lastReminderDay`). WhatsApp + in-app feed.
 *
 * Everything is hardcoded in the streaks feature config for the pilot (enable +
 * lead time + hours); this task is a thin orchestrator. Pause it in the
 * Trigger.dev dashboard to disable.
 */
export const streakAtRiskReminderTask = schedules.task({
  id: "streak-at-risk-reminder",
  cron: "0 * * * *",
  run: async () => {
    if (!REMINDER_ENABLED) return { skipped: "disabled" as const };

    const now = new Date();
    const today = localDay(now);

    const close = closeTimeFor(today);
    if (!close) return { skipped: "store-closed" as const };

    const windowStart = close.getTime() - REMINDER_HOURS_BEFORE * HOUR_MS;
    if (now.getTime() < windowStart || now.getTime() >= close.getTime()) {
      return { skipped: "outside-window" as const };
    }

    // The last OPEN day already closed (skips closed days). A live streak must
    // have its last purchase on this day to be at risk of breaking today.
    const lastPassed = mostRecentPassedOpenDay(now);
    if (!lastPassed) return { skipped: "no-prior-open-day" as const };

    const orgId = await getPrimaryOrganizationId();
    if (!orgId) return { skipped: "no-org" as const };

    const repo = new StreaksRepository(db);
    const atRisk = await repo.atRiskCustomers(orgId, lastPassed, today);
    if (atRisk.length === 0) return { sent: 0, hoursLeft: 0 };

    const hoursLeft = Math.max(
      1,
      Math.ceil((close.getTime() - now.getTime()) / HOUR_MS),
    );

    for (const c of atRisk) {
      await tasks.trigger("send-notification", {
        customerIds: [c.customerId],
        organizationId: orgId,
        notificationKey: "streak-at-risk",
        payload: { currentCount: c.currentCount, hoursLeft },
      });
    }
    await repo.markReminded(
      atRisk.map((c) => c.id),
      today,
    );

    const result = { sent: atRisk.length, hoursLeft };
    logger.info("streak-at-risk-reminder done", result);
    return result;
  },
});
