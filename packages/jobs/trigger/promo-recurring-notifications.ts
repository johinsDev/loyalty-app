import { PromoRepository } from "@loyalty/api/features/promotions";
import { db } from "@loyalty/db";
import { logger, schedules, tasks } from "@trigger.dev/sdk/v3";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fires weekly-recurring promo notifications. Runs daily; for each due
 * `repeat=weekly` notification it enqueues `send-promo-notification` and bumps
 * its `scheduledAt` one week forward (the row stays `scheduled`).
 */
export const promoRecurringNotificationsTask = schedules.task({
  id: "promo-recurring-notifications",
  cron: "0 13 * * *", // 13:00 UTC daily
  run: async () => {
    const repo = new PromoRepository(db);
    const now = new Date();
    const due = await repo.dueRecurringNotifications(now);
    let fired = 0;
    for (const n of due) {
      const aud = n.audienceValue
        ? (JSON.parse(n.audienceValue) as { tierKey?: string; customerIds?: string[] })
        : {};
      const promo = await repo.findPromoUnscoped(n.promoId).catch(() => null);
      if (!promo) continue;
      await tasks
        .trigger("send-promo-notification", {
          organizationId: promo.organizationId,
          promoId: n.promoId,
          notificationId: n.id,
          audienceType: n.audienceType as "all" | "tier" | "specific",
          tierKey: aud.tierKey,
          customerIds: aud.customerIds,
          channels: JSON.parse(n.channels) as string[],
        })
        .catch((e) => logger.error("promo-recurring trigger failed", { id: n.id, error: String(e) }));
      const base = n.scheduledAt ?? now;
      await repo.bumpNotificationSchedule(n.id, new Date(base.getTime() + WEEK_MS));
      fired += 1;
    }
    logger.info("promo-recurring-notifications done", { fired });
    return { fired };
  },
});
