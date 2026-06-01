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

    // Per-channel tallies so the run output reflects what actually happened
    // (a recipient counts as "with failures" if ANY channel failed, but the
    // per-channel breakdown shows mail/sms/database succeeded even when
    // push/realtime didn't).
    const channels: Record<
      string,
      { sent: number; skipped: number; failed: number }
    > = {};
    let recipientsAllOk = 0;
    let recipientsWithFailures = 0;
    // Surfaced in the run Output so the cause of a failed channel is visible
    // without digging into the per-recipient logs.
    const errors: Array<{ customerId: string; channel: string; error: string }> =
      [];

    for (const customerId of customerIds) {
      try {
        const result = await notifier.send(
          { customerId, organizationId },
          createNotification(notificationKey, payload),
        );
        for (const r of result.results) {
          const tally = (channels[r.channel] ??= {
            sent: 0,
            skipped: 0,
            failed: 0,
          });
          tally[r.status] += 1;
          if (r.status === "failed" && r.error) {
            errors.push({
              customerId,
              channel: r.channel,
              error: r.error.message,
            });
          }
        }
        if (result.ok) recipientsAllOk += 1;
        else recipientsWithFailures += 1;
        logger.info("send-notification recipient", {
          customerId,
          ok: result.ok,
          results: result.results.map((r) => ({
            channel: r.channel,
            status: r.status,
            reason: r.reason,
            // Surface WHY a channel failed (e.g. realtime can't reach the
            // local PartyKit) — otherwise the cause is invisible.
            error: r.error?.message,
          })),
        });
      } catch (error) {
        recipientsWithFailures += 1;
        logger.error("send-notification recipient failed", {
          customerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const output = {
      recipients: customerIds.length,
      recipientsAllOk,
      recipientsWithFailures,
      channels,
      errors,
    };
    logger.info("send-notification done", output);
    return output;
  },
});
