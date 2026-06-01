/**
 * Core shared types for `@loyalty/notifications`.
 *
 * The engine sits one layer above the channel transports (`@loyalty/email`,
 * `/sms`, `/push`, `/whatsapp`, `/realtime`, plus the in-app `database`
 * channel). A single `Notification` fans out to many channels; each channel
 * delegates to an injected transport. See `.claude/skills/notifications/SKILL.md`.
 */

/** Built-in channel keys. */
export type BuiltInChannelName =
  | "mail"
  | "sms"
  | "push"
  | "whatsapp"
  | "realtime"
  | "database";

/**
 * A channel name is any registered key. Kept as a widened string so custom
 * channels need no edit to this union.
 */
export type ChannelName = BuiltInChannelName | (string & {});

/**
 * Categories gate opt-out. `marketing` is suppressible by customer
 * preference; everything else (transactional, otp, …) is mandatory and
 * always sends.
 */
export type NotificationCategory =
  | "marketing"
  | "transactional"
  | "otp"
  | (string & {});

/** Categories a customer is allowed to opt out of. */
export const OPT_OUTABLE_CATEGORIES: ReadonlySet<NotificationCategory> =
  new Set<NotificationCategory>(["marketing"]);

/** True when a category may be suppressed by a per-channel preference. */
export function isOptOutable(category: NotificationCategory): boolean {
  return OPT_OUTABLE_CATEGORIES.has(category);
}

/**
 * Caller-facing recipient. Either a fully described object or — when only an
 * id is known — the engine hydrates the rest via `NotifiableRepository`.
 * `organizationId` is required because customers are org-scoped.
 */
export interface Notifiable {
  customerId: string;
  organizationId: string;
  /** Pre-resolved contact info. Optional — the repository fills the gaps. */
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

/**
 * Fully hydrated recipient the channels read from. `phone` is guaranteed
 * (notnull on the `customer` table); `email`/`name` may be null.
 */
export interface ResolvedNotifiable {
  customerId: string;
  organizationId: string;
  phone: string;
  email: string | null;
  name: string | null;
}

/** Accepted `send()` targets: a full notifiable, or `{ customerId, organizationId }`. */
export type NotifiableInput = Notifiable;

/** Why a channel did not send. */
export type SkipReason =
  | "opted-out"
  | "no-method"
  | "no-contact"
  | "not-registered";

/** Per-channel outcome. One channel failing never aborts the others. */
export interface ChannelResult {
  channel: ChannelName;
  status: "sent" | "skipped" | "failed";
  reason?: SkipReason;
  /** Whatever the underlying transport returned (EmailResponse, SmsResponse, …). */
  response?: unknown;
  error?: Error;
}

/** Aggregate result of a single `notifier.send()`. */
export interface SendResult {
  /** The notification class name (e.g. `NewUserNotification`). */
  notification: string;
  customerId: string;
  category: NotificationCategory;
  results: ChannelResult[];
  /** True when no channel failed (skips don't count as failures). */
  ok: boolean;
}

/**
 * Structural slice of `@loyalty/log`'s `Logger` the notifier writes to.
 * Kept narrow so swapping loggers (or fakes) doesn't widen the surface.
 */
export interface NotifierLogger {
  info(bindings: Record<string, unknown>, msg?: string): void;
  warn(bindings: Record<string, unknown>, msg?: string): void;
  error(bindings: Record<string, unknown>, msg?: string): void;
}

export type NotifierLogLevel = "debug" | "info" | "silent";
