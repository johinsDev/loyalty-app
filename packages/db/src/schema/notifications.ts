import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization } from "./auth";
import { customer } from "./loyalty";

/**
 * `notification` — the in-app feed and the persistence target for the
 * `database` channel in `@loyalty/notifications`. Every notification sent on
 * the `database` channel writes a row here so the customer can read it later
 * (and mark it read). `category` is stored so the feed can style marketing vs
 * transactional. See `.claude/skills/notifications/SKILL.md`.
 */
export const notification = sqliteTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Discriminator the UI renders against (e.g. `welcome`, `promo`). */
    type: text("type").notNull(),
    /** `marketing` | `transactional` | `otp` | … (from the Notification). */
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: text("data", { mode: "json" }),
    /** Null until the customer opens it. */
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    feedIdx: index("notification_feed_idx").on(
      t.customerId,
      t.organizationId,
      t.readAt,
    ),
    createdAtIdx: index("notification_created_at_idx").on(
      t.customerId,
      t.createdAt,
    ),
  }),
);

export type NotificationRow = typeof notification.$inferSelect;
export type NotificationInsert = typeof notification.$inferInsert;

/**
 * `notification_preference` — per-channel marketing opt-out. One row per
 * `(customer, organization, channel)`. **Absence of a row means subscribed**;
 * a row with `marketingEnabled = false` means the customer opted out of
 * marketing on that channel. Transactional / OTP notifications ignore this
 * table entirely (they always send).
 */
export const notificationPreference = sqliteTable(
  "notification_preference",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** `mail` | `sms` | `push` | `whatsapp` | `realtime` | `database`. */
    channel: text("channel").notNull(),
    marketingEnabled: integer("marketing_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    customerOrgChannelUq: uniqueIndex(
      "notification_preference_customer_org_channel_uq",
    ).on(t.customerId, t.organizationId, t.channel),
  }),
);

export type NotificationPreferenceRow =
  typeof notificationPreference.$inferSelect;
export type NotificationPreferenceInsert =
  typeof notificationPreference.$inferInsert;
