import { PromoRepository } from "@loyalty/api/features/promotions";
import { db } from "@loyalty/db";
import type { ChannelName } from "@loyalty/notifications";
import { logger, task } from "@trigger.dev/sdk/v3";

import { notifier } from "../notifications";
import { PromoAnnouncementNotification } from "../notifications-registry";

// Untyped at the boundary (api enqueues by id to avoid an api → jobs cycle).
// Stays in sync with packages/api/src/features/promotions/service.ts.
type Payload = {
  organizationId: string;
  promoId: string;
  notificationId: string;
  audienceType: "all" | "tier" | "specific";
  tierKey?: string;
  customerIds?: string[];
  channels: string[];
};

/**
 * Delivers a promo announcement. Resolves the audience at fire time, fans out
 * per customer through the Notifier (marketing → respects opt-out). One-shot
 * sends are scheduled with a native Trigger delay; weekly ones are fired by the
 * recurring cron (which keeps the notification `scheduled`).
 */
export const sendPromoNotificationTask = task({
  id: "send-promo-notification",
  maxDuration: 300,
  run: async (p: Payload) => {
    const repo = new PromoRepository(db);
    const promo = await repo.findById(p.organizationId, p.promoId);
    if (!promo || !promo.slug) {
      await repo.setNotificationStatus(p.notificationId, "failed");
      return { recipients: 0, error: "promo-not-found" };
    }

    const customerIds =
      p.audienceType === "tier" && p.tierKey
        ? await repo.listCustomerIdsByTier(p.organizationId, p.tierKey)
        : p.audienceType === "specific"
          ? (p.customerIds ?? [])
          : await repo.listActiveCustomerIds(p.organizationId);

    const channels = p.channels as ChannelName[];
    const content = {
      name: promo.name ?? "",
      shortDescription: promo.shortDescription ?? "",
      slug: promo.slug,
    };

    let ok = 0;
    let failed = 0;
    for (const customerId of customerIds) {
      try {
        const result = await notifier.send(
          { customerId, organizationId: p.organizationId },
          new PromoAnnouncementNotification(content, channels),
        );
        if (result.ok) ok += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        logger.error("send-promo-notification recipient failed", {
          customerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // One-shot → mark terminal; weekly stays "scheduled" (cron owns it).
    const notif = await repo.getNotification(p.notificationId);
    if (notif && notif.repeat !== "weekly") {
      await repo.setNotificationStatus(p.notificationId, failed > 0 && ok === 0 ? "failed" : "sent");
    }
    const output = { recipients: customerIds.length, ok, failed };
    logger.info("send-promo-notification done", output);
    return output;
  },
});
