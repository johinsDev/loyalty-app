import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

// End customer of the loyalty program (distinct from `user`, which is the
// staff/owner. A customer is identified by phone primarily — they don't need
// to create an account to participate).
export const customer = pgTable(
  "customer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    email: text("email"),
    name: text("name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    phonePerOrg: uniqueIndex("customer_phone_per_org_uq").on(t.organizationId, t.phone),
  }),
);

export const loyaltyCard = pgTable("loyalty_card", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customer.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  currentStamps: integer("current_stamps").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Append-only log of every stamp granted. Source of truth for currentStamps.
export const stamp = pgTable("stamp", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => loyaltyCard.id, { onDelete: "cascade" }),
  addedByUserId: text("added_by_user_id")
    .notNull()
    .references(() => user.id),
  amount: integer("amount").notNull().default(1),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reward = pgTable("reward", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  stampsRequired: integer("stamps_required").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const redemption = pgTable("redemption", {
  id: uuid("id").defaultRandom().primaryKey(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => loyaltyCard.id, { onDelete: "cascade" }),
  rewardId: uuid("reward_id")
    .notNull()
    .references(() => reward.id),
  redeemedByUserId: text("redeemed_by_user_id")
    .notNull()
    .references(() => user.id),
  stampsSpent: integer("stamps_spent").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
