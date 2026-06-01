import type { NotificationKey } from "@loyalty/api/features/notifications";
import { logger, task } from "@trigger.dev/sdk/v3";

import { createNotification } from "../notifications-registry";
import { notifier } from "../notifications";

// Untyped at the boundary on purpose — the API enqueues this by id
// (`tasks.trigger("send-notification", …)`) to avoid an api → jobs cycle.
// Shape stays in sync with packages/api/src/features/notifications/service.ts.
type Payload = {
  customerIds: string[];
  organizationId: string;
  notificationKey: NotificationKey;
  payload?: Record<string, unknown>;
};

/**
 * Fans a single notification out to many customers. For each, the Notifier
 * resolves contact info, filters channels by marketing preference, and
 * delivers across mail / sms / push / whatsapp / realtime / database — each
 * channel isolated so one failure never aborts the rest.
 */
export const sendNotificationTask = task({
  id: "send-notification",
  maxDuration: 120,
  run: async ({ customerIds, organizationId, notificationKey, payload }: Payload) => {
    logger.info("send-notification start", {
      notificationKey,
      recipients: customerIds.length,
    });

    let ok = 0;
    let failed = 0;
    for (const customerId of customerIds) {
      try {
        const result = await notifier.send(
          { customerId, organizationId },
          createNotification(notificationKey, payload),
        );
        if (result.ok) ok += 1;
        else failed += 1;
        logger.info("send-notification recipient", {
          customerId,
          ok: result.ok,
          results: result.results.map((r) => ({
            channel: r.channel,
            status: r.status,
            reason: r.reason,
          })),
        });
      } catch (error) {
        failed += 1;
        logger.error("send-notification recipient failed", {
          customerId,
          error: String(error),
        });
      }
    }

    logger.info("send-notification done", { ok, failed });
    return { ok, failed, total: customerIds.length };
  },
});
