import type { LoyaltyModeChange } from "@loyalty/api/features/settings";
import { listCustomerIds } from "@loyalty/db";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";

// Untyped at the boundary on purpose — the settings service enqueues this by
// id (`tasks.trigger("announce-loyalty-mode", …)`) to avoid an api → jobs cycle.
type Payload = {
  organizationId: string;
  changes: LoyaltyModeChange[];
};

const BATCH = 100;

/** Copy per change. Registry classes are es-first like the rest (pilot). */
const COPY: Record<LoyaltyModeChange, { title: string; body: string }> = {
  "points-paused": {
    title: "Los puntos se pausan ⏸️",
    body: "Por ahora no se acumulan puntos nuevos. Los que ya tenés siguen disponibles para canjear.",
  },
  "points-resumed": {
    title: "¡Volvieron los puntos! 🎉",
    body: "Ya acumulás puntos con cada compra otra vez. Tu nivel te espera.",
  },
  "stamps-paused": {
    title: "Los sellos se pausan ⏸️",
    body: "Por ahora no se otorgan sellos nuevos. Los que ya tenés siguen disponibles para canjear.",
  },
  "stamps-resumed": {
    title: "¡Volvieron los sellos! 🎉",
    body: "Ya sumás sellos con cada compra otra vez.",
  },
};

/**
 * Fans a loyalty-mode change announcement out to EVERY customer of the org
 * (feed + push, transactional). The tRPC `notifications.send` caps its input at
 * 500 ids, so this job pages the customer table itself and enqueues
 * `send-notification` in batches — one announcement per change (a
 * stamps→points switch sends both "stamps paused" and "points resumed").
 */
export const announceLoyaltyModeTask = task({
  id: "announce-loyalty-mode",
  maxDuration: 300,
  run: async ({ organizationId, changes }: Payload) => {
    const ids = await listCustomerIds(organizationId);

    let enqueued = 0;
    for (const change of changes) {
      const copy = COPY[change];
      for (let i = 0; i < ids.length; i += BATCH) {
        await tasks.trigger("send-notification", {
          customerIds: ids.slice(i, i + BATCH),
          organizationId,
          notificationKey: "loyalty-mode",
          payload: copy,
        });
        enqueued += 1;
      }
    }

    const result = { customers: ids.length, changes: changes.length, batches: enqueued };
    logger.info("announce-loyalty-mode done", result);
    return result;
  },
});
