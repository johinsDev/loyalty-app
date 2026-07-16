import { z } from "zod";

/** Channels a customer can manage a marketing opt-out for in their profile. */
export const preferenceChannelSchema = z.enum([
  "mail",
  "sms",
  "push",
  "whatsapp",
]);

/** Notification classes the admin can dispatch. Maps to the jobs registry. */
export const notificationKeySchema = z.enum([
  "new-user",
  "promo",
  "first-purchase",
  "stamp-earned",
  "reward-claimed",
  "reward-claim-code",
  "streak-completed",
  "streak-reward-claimed",
  "streak-at-risk",
  "purchase-recap",
  "purchase-receipt",
  "purchase-voided",
  "purchase-rewards-recap",
  "reward-available",
  "reward-reminder",
  "tier-up",
  "tier-down",
  "tier-near",
  "phone-changed",
  "loyalty-mode",
]);

export const feedFilterSchema = z.enum(["all", "unread"]);

/** Current customer's in-app feed. */
export const listMineInputSchema = z.object({
  filter: feedFilterSchema.default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const markReadInputSchema = z.object({
  id: z.string().uuid(),
});

export const deleteInputSchema = z.object({
  id: z.string().uuid(),
});

/** Toggle one channel's marketing opt-in. */
export const setPreferenceInputSchema = z.object({
  channel: preferenceChannelSchema,
  marketingEnabled: z.boolean(),
});

/** Admin: dispatch a notification to one or more customers. */
export const sendInputSchema = z.object({
  // Customer ids mirror Better Auth `user.id` (not necessarily a UUID), so
  // validate as a non-empty string rather than `.uuid()`.
  customerIds: z.array(z.string().min(1)).min(1).max(500),
  notificationKey: notificationKeySchema,
  /** Optional per-notification overrides (e.g. promo title/body). */
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const listCustomersInputSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(100),
});

export type ListMineInput = z.infer<typeof listMineInputSchema>;
export type SetPreferenceInput = z.infer<typeof setPreferenceInputSchema>;
export type SendInput = z.infer<typeof sendInputSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersInputSchema>;
export type PreferenceChannel = z.infer<typeof preferenceChannelSchema>;
export type NotificationKey = z.infer<typeof notificationKeySchema>;
export type FeedFilter = z.infer<typeof feedFilterSchema>;

// ─── Automated-trigger config ────────────────────────────────────────────────
/**
 * Security/critical triggers that ALWAYS send — the config UI shows them
 * read-only and the send job ignores any config row for them.
 */
export const PROTECTED_NOTIFICATION_KEYS = [
  "reward-claim-code",
  "phone-changed",
] as const;

/** Channels the admin can configure a trigger to use. */
export const configChannelSchema = z.enum([
  "push",
  "mail",
  "sms",
  "whatsapp",
  "database",
]);

export const setConfigInputSchema = z.object({
  notificationKey: notificationKeySchema,
  enabled: z.boolean(),
  /** null = use the notification's declared channels. */
  channels: z.array(configChannelSchema).min(1).nullable(),
});

export interface NotificationConfigView {
  notificationKey: string;
  enabled: boolean;
  channels: string[] | null;
  /** Protected triggers are always-on and not editable. */
  isProtected: boolean;
}
