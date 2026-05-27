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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Append-only log of every stamp granted. Source of truth for currentStamps.
export const stamp = sqliteTable("stamp", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  cardId: text("card_id")
    .notNull()
    .references(() => loyaltyCard.id, { onDelete: "cascade" }),
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

export const customerRelations = relations(customer, ({ one, many }) => ({
  organization: one(organization, {
    fields: [customer.organizationId],
    references: [organization.id],
  }),
  cards: many(loyaltyCard),
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
  stamps: many(stamp),
  redemptions: many(redemption),
}));

export const stampRelations = relations(stamp, ({ one }) => ({
  card: one(loyaltyCard, {
    fields: [stamp.cardId],
    references: [loyaltyCard.id],
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
