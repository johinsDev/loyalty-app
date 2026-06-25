import { relations } from "drizzle-orm";
import {
  index,
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
    // Personal handle, unique per org (stored lowercased). Optional.
    nickname: text("nickname"),
    // Avatar is one of: a preset id (avatarPreset), a custom upload
    // (avatarUrl + avatarThumbhash), or none (initials fallback). The three
    // are kept mutually exclusive by the profile service.
    avatarPreset: text("avatar_preset"),
    avatarUrl: text("avatar_url"),
    avatarThumbhash: text("avatar_thumbhash"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    phonePerOrg: uniqueIndex("customer_phone_per_org_uq").on(t.organizationId, t.phone),
    nicknamePerOrg: uniqueIndex("customer_nickname_per_org_uq").on(
      t.organizationId,
      t.nickname,
    ),
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

// A claimable reward in the catalog. Cost is in stamps and/or points (spendable
// balances — see pointsTransaction / loyaltyCard). When BOTH costs are set,
// `costMode` decides redemption: "or" (customer pays one) | "and" (pays both).
// `allowedTiers` (json array of points-tier keys; null = every tier) gates the
// reward by level. `sections` (json array, e.g. ["destacados"]) + `sortOrder`
// drive the curated rows on /recompensas. `limitPerCustomer`: "unlimited"
// (repeatable, re-arms when the balance is re-accumulated) | "once".
export const reward = sqliteTable("reward", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  // Cost per currency (nullable = that currency isn't accepted for this reward).
  // At least one must be set. `stampsRequired` is the stamps cost.
  stampsRequired: integer("stamps_required"),
  pointsCost: integer("points_cost"),
  // "or" | "and" — only meaningful when both costs are set.
  costMode: text("cost_mode").notNull().default("or"),
  // JSON array of tier keys allowed to claim (null = all tiers).
  allowedTiers: text("allowed_tiers", { mode: "json" }).$type<string[] | null>(),
  // JSON array of curated section keys (e.g. ["novedades","destacados"]).
  sections: text("sections", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  // "unlimited" | "once"
  limitPerCustomer: text("limit_per_customer").notNull().default("unlimited"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A single reward claim. Multi-currency: `currency` says which balance was
// spent ("stamps" | "points"); the matching *Spent column holds the amount, the
// other is 0. `cardId` is null for points-only claims (no stamp card involved).
// `customerId`/`organizationId` are denormalized for history + the "once" check.
export const redemption = sqliteTable(
  "redemption",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Nullable so the columns can be added to the pre-existing table, and
    // because legacy rows (pre-rewards "premios" redemptions) have no customer
    // attribution. The claim flow always sets both on new rows.
    // Nullable so the columns could be added to the pre-existing table, and
    // because legacy rows (pre-rewards "premios" redemptions) have no customer
    // attribution. The claim flow always sets both on new rows.
    customerId: text("customer_id").references(() => customer.id, {
      onDelete: "cascade",
    }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    // The stamp card the stamps were spent from (null for points-only claims).
    cardId: text("card_id").references(() => loyaltyCard.id, {
      onDelete: "set null",
    }),
    rewardId: text("reward_id")
      .notNull()
      .references(() => reward.id),
    redeemedByUserId: text("redeemed_by_user_id")
      .notNull()
      .references(() => user.id),
    currency: text("currency").notNull().default("stamps"), // "stamps" | "points"
    stampsSpent: integer("stamps_spent").notNull().default(0),
    pointsSpent: integer("points_spent").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byCustomer: index("redemption_customer_idx").on(
      t.organizationId,
      t.customerId,
      t.createdAt,
    ),
    byCustomerReward: index("redemption_customer_reward_idx").on(
      t.customerId,
      t.rewardId,
    ),
  }),
);

// Per-(customer, reward) availability cycle, driving the reminder cron. A row
// exists while a reward is ready-and-unclaimed for the customer: `readyAt` is
// when it became ready in the current cycle, `lastStage` is the last reminder
// stage sent ("immediate" | "d2" | "d7" | "d30"). The purchase flow upserts it
// on unlock; claim (or the balance dropping below cost) deletes it, so a
// repeatable reward re-arms fresh next time.
export const rewardAvailability = sqliteTable(
  "reward_availability",
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
    rewardId: text("reward_id")
      .notNull()
      .references(() => reward.id, { onDelete: "cascade" }),
    readyAt: integer("ready_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastStage: text("last_stage").notNull().default("immediate"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    perCustomerReward: uniqueIndex("reward_availability_customer_reward_uq").on(
      t.customerId,
      t.rewardId,
    ),
    byReadyAt: index("reward_availability_ready_idx").on(t.readyAt),
  }),
);

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

// Points ledger — the source of truth for a customer's spendable balance AND
// their tier. `points` is signed: earn (+), redeem (−), adjust (±). Balance =
// SUM(points); tier-points = SUM(earn within the rolling window). Runs alongside
// stamps; a future `loyaltyMode` picks stamps vs points per org.
export const pointsTransaction = sqliteTable(
  "points_transaction",
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
    type: text("type").notNull(), // "earn" | "redeem" | "adjust"
    points: integer("points").notNull(),
    reason: text("reason"),
    // The purchase that earned these points (null for redeem/adjust). Unique per
    // org so a retried purchase can't double-earn.
    purchaseId: text("purchase_id").references(() => purchase.id, {
      onDelete: "set null",
    }),
    addedByUserId: text("added_by_user_id").references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byCustomer: index("points_tx_customer_idx").on(
      t.organizationId,
      t.customerId,
      t.createdAt,
    ),
    earnPerPurchase: uniqueIndex("points_tx_purchase_uq").on(
      t.organizationId,
      t.purchaseId,
    ),
  }),
);

// Cached tier state per customer — balance + tier-points are derived from the
// ledger, but the current tier is stored here so transitions (up/down) and the
// "almost at next level" nudge can be detected and de-duped.
export const pointsAccount = sqliteTable("points_account", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id")
    .notNull()
    .unique()
    .references(() => customer.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  currentTierKey: text("current_tier_key"),
  // The next-tier key we already sent the ~80% nudge for (dedupe, once per tier).
  nearNotifiedTierKey: text("near_notified_tier_key"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pointsTransactionRelations = relations(
  pointsTransaction,
  ({ one }) => ({
    customer: one(customer, {
      fields: [pointsTransaction.customerId],
      references: [customer.id],
    }),
    organization: one(organization, {
      fields: [pointsTransaction.organizationId],
      references: [organization.id],
    }),
    purchase: one(purchase, {
      fields: [pointsTransaction.purchaseId],
      references: [purchase.id],
    }),
  }),
);

export const pointsAccountRelations = relations(pointsAccount, ({ one }) => ({
  customer: one(customer, {
    fields: [pointsAccount.customerId],
    references: [customer.id],
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
  customer: one(customer, {
    fields: [redemption.customerId],
    references: [customer.id],
  }),
  organization: one(organization, {
    fields: [redemption.organizationId],
    references: [organization.id],
  }),
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

export const rewardAvailabilityRelations = relations(
  rewardAvailability,
  ({ one }) => ({
    customer: one(customer, {
      fields: [rewardAvailability.customerId],
      references: [customer.id],
    }),
    organization: one(organization, {
      fields: [rewardAvailability.organizationId],
      references: [organization.id],
    }),
    reward: one(reward, {
      fields: [rewardAvailability.rewardId],
      references: [reward.id],
    }),
  }),
);

export type CustomerRow = typeof customer.$inferSelect;
export type LoyaltyCardRow = typeof loyaltyCard.$inferSelect;
export type LoyaltyCardInsert = typeof loyaltyCard.$inferInsert;
export type PurchaseRow = typeof purchase.$inferSelect;
export type PurchaseInsert = typeof purchase.$inferInsert;
export type StampRow = typeof stamp.$inferSelect;
export type StampInsert = typeof stamp.$inferInsert;
export type StreakRow = typeof streak.$inferSelect;
export type StreakInsert = typeof streak.$inferInsert;
export type PointsTransactionRow = typeof pointsTransaction.$inferSelect;
export type PointsTransactionInsert = typeof pointsTransaction.$inferInsert;
export type PointsAccountRow = typeof pointsAccount.$inferSelect;
export type PointsAccountInsert = typeof pointsAccount.$inferInsert;
export type RewardRow = typeof reward.$inferSelect;
export type RewardInsert = typeof reward.$inferInsert;
export type RedemptionRow = typeof redemption.$inferSelect;
export type RedemptionInsert = typeof redemption.$inferInsert;
export type RewardAvailabilityRow = typeof rewardAvailability.$inferSelect;
export type RewardAvailabilityInsert = typeof rewardAvailability.$inferInsert;
