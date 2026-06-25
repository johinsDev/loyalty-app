import { getPrimaryOrganizationId, db } from "@loyalty/db";
import {
  REMINDER_ENABLED,
  REMINDER_STAGES,
  RewardsRepository,
} from "@loyalty/api/features/rewards";
import { logger, schedules, tasks } from "@trigger.dev/sdk/v3";

/**
 * Daily "you have an unclaimed reward" nudge. Scans `reward_availability` rows
 * (a row exists while a reward is ready-and-unclaimed for a customer) and, for
 * each whose age has crossed into the next reminder stage (+2d → d2, +7d → d7,
 * +30d → d30) beyond its `lastStage`, fires `reward-reminder` and advances the
 * stage (dedup, once per stage). Claiming (or the balance dropping below cost)
 * deletes the row, so a claimed reward stops reminding. Thin orchestrator; the
 * repository owns the due-stage math. Pause in the Trigger.dev dashboard.
 */
export const rewardReminderTask = schedules.task({
  id: "reward-reminder",
  cron: "0 7 * * *",
  run: async () => {
    if (!REMINDER_ENABLED) return { skipped: "disabled" as const };

    const orgId = await getPrimaryOrganizationId();
    if (!orgId) return { skipped: "no-org" as const };

    const repo = new RewardsRepository(db);
    const due = await repo.listDueReminders(orgId, REMINDER_STAGES);
    if (due.length === 0) return { sent: 0 };

    for (const row of due) {
      await tasks
        .trigger("send-notification", {
          customerIds: [row.customerId],
          organizationId: orgId,
          notificationKey: "reward-reminder",
          payload: { rewardName: row.rewardName, stage: row.dueStage },
        })
        .catch(() => {});
      await repo.advanceStage(row.id, row.dueStage).catch(() => {});
    }

    const result = { sent: due.length };
    logger.info("reward-reminder done", result);
    return result;
  },
});
