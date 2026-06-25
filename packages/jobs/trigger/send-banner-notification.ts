import { BannersRepository } from "@loyalty/api/features/banners";
import { db } from "@loyalty/db";
import type { ChannelName } from "@loyalty/notifications";
import { logger, task } from "@trigger.dev/sdk/v3";

import { notifier } from "../notifications";
import { BannerNotification } from "../notifications-registry";

// Untyped at the boundary (api enqueues this by id to avoid an api → jobs
// cycle). Stays in sync with packages/api/src/features/banners/service.ts.
type Payload = {
  organizationId: string;
  bannerId: string;
  notificationId: string;
  audienceType: "all" | "tier" | "specific";
  tierKey?: string;
  customerIds?: string[];
  channels: string[];
};

/**
 * Delivers a banner announcement. Resolves the audience at fire time
 * (all / by tier / specific), then fans out per customer through the Notifier
 * (marketing category → respects opt-out). Triggered by the API with a native
 * Trigger.dev `delay` for scheduled sends; the API tracks the run id so it can
 * cancel/reschedule.
 */
export const sendBannerNotificationTask = task({
  id: "send-banner-notification",
  maxDuration: 300,
  run: async (p: Payload) => {
    const repo = new BannersRepository(db);
    const banner = await repo.findById(p.organizationId, p.bannerId);
    if (!banner) {
      logger.error("send-banner-notification: banner not found", {
        bannerId: p.bannerId,
      });
      await repo.setNotificationStatus(p.notificationId, "failed");
      return { recipients: 0, error: "banner-not-found" };
    }

    const customerIds =
      p.audienceType === "tier" && p.tierKey
        ? await repo.listCustomerIdsByTier(p.organizationId, p.tierKey)
        : p.audienceType === "specific"
          ? (p.customerIds ?? [])
          : await repo.listActiveCustomerIds(p.organizationId);

    const channels = p.channels as ChannelName[];
    const content = {
      name: banner.name,
      shortDescription: banner.shortDescription ?? "",
      slug: banner.slug,
      ctaHref: banner.ctaHref,
    };

    logger.info("send-banner-notification start", {
      bannerId: banner.id,
      audienceType: p.audienceType,
      recipients: customerIds.length,
      channels,
    });

    let ok = 0;
    let failed = 0;
    for (const customerId of customerIds) {
      try {
        const result = await notifier.send(
          { customerId, organizationId: p.organizationId },
          new BannerNotification(content, channels),
        );
        if (result.ok) ok += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        logger.error("send-banner-notification recipient failed", {
          customerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await repo.setNotificationStatus(
      p.notificationId,
      failed > 0 && ok === 0 ? "failed" : "sent",
    );
    const output = { recipients: customerIds.length, ok, failed };
    logger.info("send-banner-notification done", output);
    return output;
  },
});
