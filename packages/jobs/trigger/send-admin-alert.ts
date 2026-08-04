import {
  ADMIN_ALERTS,
  AdminNotificationRepository,
  AdminNotificationService,
  type AdminAlertType,
} from "@loyalty/api/features/admin-notifications";
import { NotificationConfigRepository } from "@loyalty/api/features/notifications";
import { db } from "@loyalty/db";
import type { ChannelName } from "@loyalty/notifications";
import { logger, task } from "@trigger.dev/sdk/v3";

import { createAdminAlert } from "../admin-alerts-registry";
import { notifier } from "../notifications";
import { realtime } from "../realtime";

// Untyped at the boundary on purpose — the API enqueues this by id
// (`tasks.trigger("send-admin-alert", …)`) to avoid an api → jobs cycle.
// Shape stays in sync with packages/api/src/features/_shared/audit-alert.ts.
type Payload = {
  organizationId: string;
  alertType: AdminAlertType;
  storeId?: string | null;
  actorUserId?: string | null;
  entity?: { type: string; id: string };
  payload?: Record<string, unknown>;
};

/** Cap so one noisy event can't burn the task budget on a huge roster. */
const MAX_RECIPIENTS = 200;

/**
 * Fans one operator alert out to everyone who should hear it.
 *
 * The audience rules (role floor, store scoping, excluding the actor) live in
 * the API service — this task only orchestrates.
 *
 * Realtime is published ONCE at the end rather than per recipient, and carries
 * only `{type, severity}`: every operator can join the org room, but who may
 * see an alert is enforced per row in SQL, so the signal must not leak copy.
 */
export const sendAdminAlertTask = task({
  id: "send-admin-alert",
  maxDuration: 120,
  run: async ({
    organizationId,
    alertType,
    storeId,
    actorUserId,
    entity,
    payload,
  }: Payload) => {
    const def = ADMIN_ALERTS[alertType];
    logger.info("send-admin-alert start", { alertType, storeId });

    // Per-org trigger config, same contract as customer notifications: a
    // disabled alert is suppressed; a channel override restricts delivery but
    // can never drop the inbox row itself.
    const cfg = await new NotificationConfigRepository(db).get(
      organizationId,
      alertType,
    );
    if (cfg && !cfg.enabled) {
      logger.info("send-admin-alert: alert disabled, skipping", { alertType });
      return { alertType, disabled: true, recipients: 0 };
    }
    let onlyChannels = (cfg?.channels as ChannelName[] | null) ?? undefined;
    if (onlyChannels && !onlyChannels.includes("database" as ChannelName)) {
      onlyChannels = [...onlyChannels, "database" as ChannelName];
    }

    const service = new AdminNotificationService(
      new AdminNotificationRepository(db),
    );
    const scopedStoreId = def.storeScoped ? (storeId ?? null) : null;
    const audience = await service.audienceFor(
      organizationId,
      alertType,
      scopedStoreId,
      actorUserId,
    );

    if (audience.length === 0) {
      logger.info("send-admin-alert: nobody to tell", { alertType });
      return { alertType, recipients: 0 };
    }
    const recipients = audience.slice(0, MAX_RECIPIENTS);
    if (audience.length > recipients.length) {
      logger.warn("send-admin-alert: audience capped", {
        alertType,
        total: audience.length,
        capped: recipients.length,
      });
    }

    const names = await service.resolveDisplayNames(entity, actorUserId);
    const notification = createAdminAlert(alertType, {
      ...names,
      entity,
      storeId: scopedStoreId,
      payload,
    });

    let ok = 0;
    let failed = 0;
    const errors: Array<{ userId: string; error: string }> = [];
    // oxlint-disable no-await-in-loop -- sequential on purpose: the roster is
    // tiny and one recipient failing must not abort the rest.
    for (const userId of recipients) {
      try {
        const result = await notifier.send(
          { kind: "user", userId, organizationId, storeId: scopedStoreId },
          notification,
          onlyChannels ? { onlyChannels } : undefined,
        );
        if (result.ok) ok += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        errors.push({
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // One signal for the whole org — each client refetches its own inbox,
    // which SQL has already filtered by user_id.
    try {
      await realtime.publish(`org:${organizationId}`, {
        event: "admin.alert",
        data: { type: alertType, severity: def.severity },
      });
    } catch (error) {
      logger.warn("send-admin-alert: realtime publish failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const output = {
      alertType,
      recipients: recipients.length,
      ok,
      failed,
      errors,
    };
    logger.info("send-admin-alert done", output);
    return output;
  },
});
