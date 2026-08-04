import { z } from "zod";

import { listQueryBase } from "../_shared/list";
import { ADMIN_ALERT_TYPES } from "./catalog";

/**
 * Alert keys live in their own enum, deliberately NOT merged into
 * `notificationKeySchema` (the customer-facing one). Widening that enum would
 * make every alert a legal input to `notifications.send`, which is the admin's
 * "blast this to N customers" endpoint — a manager could mail `daily-digest`
 * to the whole customer base. `notification_config.notificationKey` is plain
 * text, so both enums share that table with no schema change.
 */
export const adminAlertTypeSchema = z.enum(ADMIN_ALERT_TYPES);
export const adminAlertSeveritySchema = z.enum([
  "info",
  "success",
  "warning",
  "critical",
]);

/** Which side of the inbox you're looking at. */
export const adminInboxTabSchema = z.enum(["inbox", "archive"]);
export const adminReadStateSchema = z.enum(["read", "unread"]);

export const adminAlertsListInputSchema = listQueryBase.extend({
  tab: adminInboxTabSchema.default("inbox"),
  /**
   * Store scope from the admin switcher. Omitted = "all" (everything I can
   * see). When set, org-wide alerts (`storeId IS NULL`) still come through —
   * they belong to every scope.
   */
  storeId: z.string().min(1).optional(),
  type: z.array(adminAlertTypeSchema).optional(),
  severity: z.array(adminAlertSeveritySchema).optional(),
  read: adminReadStateSchema.optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});

export const unreadCountInputSchema = z.object({
  storeId: z.string().min(1).optional(),
});

export const alertIdSchema = z.object({ id: z.string().uuid() });
export const alertIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export type AdminAlertsListInput = z.infer<typeof adminAlertsListInputSchema>;
export type AdminInboxTab = z.infer<typeof adminInboxTabSchema>;
export type AdminAlertTypeInput = z.infer<typeof adminAlertTypeSchema>;

/** Row shape the inbox and the data-table render. */
export interface AdminAlertListItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  data: unknown;
  storeId: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}
