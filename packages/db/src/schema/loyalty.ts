import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";
import { promo, type PromoItemRef } from "./promotions";
import { store } from "./store";

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
    // Date of birth (nullable). Powers birthday promos (the Oro tier already
    // promises a birthday drink). Admin-editable; not collected at signup.
    birthday: integer("birthday", { mode: "timestamp" }),
    // Free-form staff note (preferences, allergies, …). Admin-only; a single
    // overwritable value, not a threaded/authored history.
    notes: text("notes"),
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

// A wallet (loyalty card): the customer's perpetual spendable stamp balance.
// The goal ("buy N, the next one's free") is org config — it resolves from the
// linked card reward's `stampsRequired` (see `organization_settings.
// stampsCardRewardId`), not from a constant. `status`: active | completed |
// claimed (legacy lifecycle; current cards stay `active`).
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
  // Eligible purchases not yet converted into a stamp (for orgs where
  // `purchasesPerStamp` > 1). Reset to 0 whenever a stamp is granted; never
  // touched by manual stamp adjustments or config changes.
  pendingPurchases: integer("pending_purchases").notNull().default(0),
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
    // The store where the sale happened. Backfilled to the org's primary store
    // for legacy rows (migration 0019). Nullable: legacy/pilot orgs may have no
    // store to attribute to; the POS always sets it on new sales.
    storeId: text("store_id").references(() => store.id),
    // `priceCents` = the NET charged (after any promo). For itemized purchases
    // `subtotalCents` + `discountCents` + `appliedPromoId` carry the breakdown.
    priceCents: integer("price_cents").notNull(),
    subtotalCents: integer("subtotal_cents"),
    discountCents: integer("discount_cents").notNull().default(0),
    currency: text("currency").notNull().default("COP"),
    appliedPromoId: text("applied_promo_id").references(() => promo.id, {
      onDelete: "set null",
    }),
    // Reserved for marketing attribution (campaign/banner/organic). Not yet
    // captured at record time — populated by a later feature.
    entrySource: text("entry_source"),
    // Free-form attributes bag so business-model changes don't force a migration.
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    // Void (anulación): set when the sale is reversed. A voided purchase keeps
    // its rows for audit but its loyalty (stamp/points/reward) is reversed and
    // it's excluded from revenue KPIs. Null = active.
    voidedAt: integer("voided_at", { mode: "timestamp" }),
    voidReason: text("void_reason"),
    voidedByUserId: text("voided_by_user_id").references(() => user.id),
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

// Itemized line items for a purchase (snapshot of price at sale time). Enables
// promo discount computation + future per-product stamp rules.
export const purchaseItem = sqliteTable(
  "purchase_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchase.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    variantId: text("variant_id"),
    modifierOptionIds: text("modifier_option_ids", { mode: "json" }).$type<string[]>(),
    qty: integer("qty").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    currency: text("currency").notNull().default("COP"),
  },
  (t) => ({
    byPurchase: index("purchase_item_purchase_idx").on(t.purchaseId),
  }),
);

// One row per promo application (usage). Drives maxUsesTotal / maxPerCustomer.
export const promoRedemption = sqliteTable(
  "promo_redemption",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    promoId: text("promo_id")
      .notNull()
      .references(() => promo.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    purchaseId: text("purchase_id")
      .notNull()
      .references(() => purchase.id, { onDelete: "cascade" }),
    discountCents: integer("discount_cents").notNull(),
    currency: text("currency").notNull().default("COP"),
    appliedAt: integer("applied_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byPromo: index("promo_redemption_promo_idx").on(t.promoId),
    byPromoCustomer: index("promo_redemption_promo_customer_idx").on(
      t.promoId,
      t.customerId,
    ),
  }),
);

export type PurchaseItemRow = typeof purchaseItem.$inferSelect;
export type PurchaseItemInsert = typeof purchaseItem.$inferInsert;
export type PromoRedemptionRow = typeof promoRedemption.$inferSelect;

// Append-only log of every stamp movement. Source of truth for currentStamps.
// A purchase-granted stamp carries its `purchaseId`; a manual admin adjustment
// has `purchaseId: null`, a signed `amount`, and a `note` (the reason).
export const stamp = sqliteTable("stamp", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  cardId: text("card_id")
    .notNull()
    .references(() => loyaltyCard.id, { onDelete: "cascade" }),
  purchaseId: text("purchase_id").references(() => purchase.id, {
    onDelete: "cascade",
  }),
  addedByUserId: text("added_by_user_id")
    .notNull()
    .references(() => user.id),
  // Store where the stamp was granted (mirrors the purchase). Backfilled from
  // the purchase (migration 0019). Nullable: mirrors the purchase, which may
  // have no store for legacy rows.
  storeId: text("store_id").references(() => store.id),
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

/** Typed reward benefit (v2). The CONFIG is the persisted source of truth —
 *  it compiles to a promo rule at evaluation time (`experience` has none). */
export type RewardBenefitConfig =
  | { type: "freeProduct"; refs: PromoItemRef[] }
  | { type: "amountOff"; amountCents: number; refs: PromoItemRef[] }
  | { type: "percentOff"; percent: number; refs: PromoItemRef[]; maxDiscountCents?: number }
  | { type: "experience" };

export const reward = sqliteTable(
  "reward",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Lifecycle: "draft" → "published" → "archived".
    status: text("status").notNull().default("draft"),
    // NOT NULL; a fresh draft is seeded with a placeholder name (the wizard
    // gallery/essence step overwrites it). Kept non-null to avoid a costly
    // sqlite table-recreate migration.
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    // freeProduct | amountOff | percentOff | experience — drives the wizard
    // forms + copy formatter; POS evaluation reads `benefit`.
    type: text("type"),
    benefit: text("benefit", { mode: "json" }).$type<RewardBenefitConfig>(),
    // Cashier-facing instruction for experience rewards ("sin fila", "empaque
    // premium"). Copy, not mechanics — editable after publish.
    fulfillmentNote: text("fulfillment_note"),
    backgroundCss: text("background_css"),
    icon: text("icon"),
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
    // JSON array of store ids this reward is available at (null/empty = every
    // store).
    storeIds: text("store_ids", { mode: "json" }).$type<string[] | null>(),
    sortOrder: integer("sort_order").notNull().default(0),
    // "unlimited" | "once"
    limitPerCustomer: text("limit_per_customer").notNull().default("unlimited"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedAt: integer("published_at", { mode: "timestamp" }),
  },
  (t) => ({
    orgStatusIdx: index("reward_org_status_idx").on(t.organizationId, t.status),
  }),
);

// Per-locale content overrides (base columns = default locale).
export const rewardTranslation = sqliteTable(
  "reward_translation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    rewardId: text("reward_id")
      .notNull()
      .references(() => reward.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    description: text("description"),
  },
  (t) => ({
    uq: uniqueIndex("reward_translation_uq").on(t.rewardId, t.locale),
  }),
);

export type RewardTranslationRow = typeof rewardTranslation.$inferSelect;

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
    // Store where the reward was redeemed. Stays nullable (like
    // organizationId/customerId) because legacy/standalone rows may have no org
    // to attribute a store from; the claim flow always sets it on new rows.
    storeId: text("store_id").references(() => store.id),
    currency: text("currency").notNull().default("stamps"), // "stamps" | "points"
    stampsSpent: integer("stamps_spent").notNull().default(0),
    pointsSpent: integer("points_spent").notNull().default(0),
    // The reward's share of the ticket discount (v2). null = legacy/unknown,
    // 0 = experience / no monetary effect, >0 = discount applied at redemption.
    discountCents: integer("discount_cents"),
    // Set when the reward is redeemed INLINE as part of a register sale (the
    // purchase detail surfaces it); always set in v2 (redemptions land on a sale).
    purchaseId: text("purchase_id").references(() => purchase.id, {
      onDelete: "set null",
    }),
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
    byPurchase: index("redemption_purchase_idx").on(t.purchaseId),
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
    // The purchase these points relate to (null for standalone redeem/adjust).
    // A retried purchase can't double-EARN (partial unique index below), but a
    // purchase may also carry manual `adjust` rows — hence the index is scoped
    // to `type = 'earn'`.
    purchaseId: text("purchase_id").references(() => purchase.id, {
      onDelete: "set null",
    }),
    addedByUserId: text("added_by_user_id").references(() => user.id),
    // Store attribution (mirrors the earning purchase). Backfilled to primary
    // for legacy rows (migration 0019). Nullable: mirrors the purchase, which
    // may have no store for legacy rows.
    storeId: text("store_id").references(() => store.id),
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
    // Partial: only `earn` rows are one-per-purchase (idempotent retries).
    // Manual `adjust` rows share the same purchaseId and must not collide.
    earnPerPurchase: uniqueIndex("points_tx_purchase_uq")
      .on(t.organizationId, t.purchaseId)
      .where(sql`${t.type} = 'earn'`),
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
  translations: many(rewardTranslation),
}));

export const rewardTranslationRelations = relations(rewardTranslation, ({ one }) => ({
  reward: one(reward, {
    fields: [rewardTranslation.rewardId],
    references: [reward.id],
  }),
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
