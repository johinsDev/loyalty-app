import { relations } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";

// End customer of the loyalty program (distinct from `user`, which is the
// staff/owner. A customer is identified by phone primarily — they don't need
// to create an account to participate).
export const customer = sqliteTable(
  "customer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    email: text("email"),
    name: text("name"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    phonePerOrg: uniqueIndex("customer_phone_per_org_uq").on(t.organizationId, t.phone),
  }),
);

// Buy-9-get-the-10th-free. The card shows WALLET_SIZE spots: STAMPS_PER_REWARD
// paid stamps + 1 free reward (the last spot). The card completes at
// STAMPS_PER_REWARD stamps; the final spot is the bebida gratis you claim.
// Hardcoded for the pilot (no per-org config yet).
export const WALLET_SIZE = 10;
export const STAMPS_PER_REWARD = WALLET_SIZE - 1;

// A wallet (loyalty card). A customer fills it one stamp at a time; at
// STAMPS_PER_REWARD it becomes `completed` (the free drink is pending to claim)
// and a fresh `active` wallet is opened. `status`: active | completed | claimed.
export const loyaltyCard = sqliteTable("loyalty_card", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  currentStamps: integer("current_stamps").notNull().default(0),
  status: text("status").notNull().default("active"),
  // 1-based index of this wallet for the customer (the Nth card they fill).
  sequence: integer("sequence").notNull().default(1),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  claimedByUserId: text("claimed_by_user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A purchase recorded at the register. Belongs to a customer; grants one stamp.
// Products/value config don't matter yet — only the price is captured.
// `idempotencyKey` makes a double-tap / retry safe (unique per org).
export const purchase = sqliteTable(
  "purchase",
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
    // The wallet this purchase filled (the stamp it granted lives there).
    walletId: text("wallet_id")
      .notNull()
      .references(() => loyaltyCard.id, { onDelete: "cascade" }),
    // The staff member who recorded it.
    addedByUserId: text("added_by_user_id")
      .notNull()
      .references(() => user.id),
    priceCents: integer("price_cents").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    idempotencyPerOrg: uniqueIndex("purchase_idempotency_per_org_uq").on(
      t.organizationId,
      t.idempotencyKey,
    ),
  }),
);

// Append-only log of every stamp granted. Source of truth for currentStamps.
// Each stamp is granted by exactly one purchase.
export const stamp = sqliteTable("stamp", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  cardId: text("card_id")
    .notNull()
    .references(() => loyaltyCard.id, { onDelete: "cascade" }),
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => purchase.id, { onDelete: "cascade" }),
  addedByUserId: text("added_by_user_id")
    .notNull()
    .references(() => user.id),
  amount: integer("amount").notNull().default(1),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const reward = sqliteTable("reward", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  stampsRequired: integer("stamps_required").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const redemption = sqliteTable("redemption", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  cardId: text("card_id")
    .notNull()
    .references(() => loyaltyCard.id, { onDelete: "cascade" }),
  rewardId: text("reward_id")
    .notNull()
    .references(() => reward.id),
  redeemedByUserId: text("redeemed_by_user_id")
    .notNull()
    .references(() => user.id),
  stampsSpent: integer("stamps_spent").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A streak: consecutive OPEN days with at least one purchase. Mirrors
// loyaltyCard's lifecycle (`status`: active | completed | claimed, `sequence` =
// the Nth streak). Closed days are skipped (neither advance nor break). At
// `goalDays` it becomes `completed` (a reward is pending to claim) and the streak
// is paused until claimed; the next purchase after the claim starts a new streak.
// `lastPurchaseDay`/`lastReminderDay` are local `YYYY-MM-DD` dates in the store
// timezone (see the streaks feature's streak-calendar).
export const streak = sqliteTable("streak", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  currentCount: integer("current_count").notNull().default(0),
  // Snapshot of the goal at creation, so changing the global goal later doesn't
  // retroactively complete/break in-flight streaks.
  goalDays: integer("goal_days").notNull(),
  status: text("status").notNull().default("active"),
  sequence: integer("sequence").notNull().default(1),
  lastPurchaseDay: text("last_purchase_day"),
  lastReminderDay: text("last_reminder_day"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  claimedAt: integer("claimed_at", { mode: "timestamp" }),
  claimedByUserId: text("claimed_by_user_id").references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const customerRelations = relations(customer, ({ one, many }) => ({
  organization: one(organization, {
    fields: [customer.organizationId],
    references: [organization.id],
  }),
  cards: many(loyaltyCard),
  purchases: many(purchase),
  streaks: many(streak),
}));

export const streakRelations = relations(streak, ({ one }) => ({
  customer: one(customer, {
    fields: [streak.customerId],
    references: [customer.id],
  }),
  organization: one(organization, {
    fields: [streak.organizationId],
    references: [organization.id],
  }),
  claimedBy: one(user, {
    fields: [streak.claimedByUserId],
    references: [user.id],
  }),
}));

export const loyaltyCardRelations = relations(loyaltyCard, ({ one, many }) => ({
  customer: one(customer, {
    fields: [loyaltyCard.customerId],
    references: [customer.id],
  }),
  organization: one(organization, {
    fields: [loyaltyCard.organizationId],
    references: [organization.id],
  }),
  claimedBy: one(user, {
    fields: [loyaltyCard.claimedByUserId],
    references: [user.id],
  }),
  stamps: many(stamp),
  purchases: many(purchase),
  redemptions: many(redemption),
}));

export const purchaseRelations = relations(purchase, ({ one }) => ({
  customer: one(customer, {
    fields: [purchase.customerId],
    references: [customer.id],
  }),
  organization: one(organization, {
    fields: [purchase.organizationId],
    references: [organization.id],
  }),
  wallet: one(loyaltyCard, {
    fields: [purchase.walletId],
    references: [loyaltyCard.id],
  }),
  addedBy: one(user, {
    fields: [purchase.addedByUserId],
    references: [user.id],
  }),
}));

export const stampRelations = relations(stamp, ({ one }) => ({
  card: one(loyaltyCard, {
    fields: [stamp.cardId],
    references: [loyaltyCard.id],
  }),
  purchase: one(purchase, {
    fields: [stamp.purchaseId],
    references: [purchase.id],
  }),
  addedBy: one(user, {
    fields: [stamp.addedByUserId],
    references: [user.id],
  }),
}));

export const rewardRelations = relations(reward, ({ one, many }) => ({
  organization: one(organization, {
    fields: [reward.organizationId],
    references: [organization.id],
  }),
  redemptions: many(redemption),
}));

export const redemptionRelations = relations(redemption, ({ one }) => ({
  card: one(loyaltyCard, {
    fields: [redemption.cardId],
    references: [loyaltyCard.id],
  }),
  reward: one(reward, {
    fields: [redemption.rewardId],
    references: [reward.id],
  }),
  redeemedBy: one(user, {
    fields: [redemption.redeemedByUserId],
    references: [user.id],
  }),
}));

export type CustomerRow = typeof customer.$inferSelect;
export type LoyaltyCardRow = typeof loyaltyCard.$inferSelect;
export type LoyaltyCardInsert = typeof loyaltyCard.$inferInsert;
export type PurchaseRow = typeof purchase.$inferSelect;
export type PurchaseInsert = typeof purchase.$inferInsert;
export type StampRow = typeof stamp.$inferSelect;
export type StampInsert = typeof stamp.$inferInsert;
export type StreakRow = typeof streak.$inferSelect;
export type StreakInsert = typeof streak.$inferInsert;
