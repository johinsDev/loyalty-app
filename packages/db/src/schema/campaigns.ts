import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";
import { customer } from "./loyalty";

/**
 * Per-channel message content for a promotional campaign. One message authored
 * per channel variant (a 160-char SMS vs a rich email vs a push title+body);
 * the reachability resolver picks ONE channel per recipient at send, and the
 * matching variant is rendered (with `{{merge}}` vars) for them.
 */
export type CampaignMessage = {
  push?: { title: string; body: string };
  email?: { subject: string; body: string };
  sms?: { text: string };
  whatsapp?: { text: string };
};

/**
 * Inline audience filter (no saved-segment entity — the filters live on the
 * campaign row and are evaluated live at send/preview time). Every field is
 * optional; an empty object targets everyone. See the campaigns feature's
 * `audience` resolver.
 */
export type CampaignAudienceFilter = {
  /** Point tier keys (e.g. ["oro", "flor"]). */
  tiers?: string[];
  /** Reachable only if their last purchase is older/newer than N days. */
  lastPurchase?: { op: "gte" | "lte"; days: number };
  /** Minimum lifetime purchase count. */
  minPurchases?: number;
  /** Signed up on/after this instant. */
  signedUpAfter?: number;
  /** Signed up on/before this instant. */
  signedUpBefore?: number;
};

/** A linked, redeemable offer for the "Canjeados" funnel stage (P3). */
export type CampaignOffer = { kind: "promo" | "reward"; id: string };

/**
 * `campaign` — the unified communication entity. In P1 it models the
 * PROMOTIONAL substrate (a generic marketing message sent to an inline
 * segment on the single best channel per recipient). Automated/transactional
 * campaigns are a config/reporting overlay layered on later phases.
 *
 * Entity-as-draft: the row exists from step 1 in `status = "draft"`, its domain
 * columns filled progressively by each wizard step and left nullable until
 * then; `publish` runs full validation and flips `status = "published"`. The
 * current step is NOT stored — it's derived from which columns are filled (see
 * the `Wizard` engine). Mirrors `promo` / `banner`.
 */
export const campaign = sqliteTable(
  "campaign",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Substrate: promotional (P1) | automated | transactional.
    type: text("type").notNull().default("promotional"),
    // Wizard lifecycle: "draft" → "published".
    status: text("status").notNull().default("draft"),
    // Send lifecycle, set by the dispatch job: null → "sending" → "sent".
    // "paused" halts an as-yet-unsent scheduled campaign.
    sendState: text("send_state"),

    // step "definition"
    name: text("name"),
    objective: text("objective"),
    // step "message"
    message: text("message", { mode: "json" }).$type<CampaignMessage>(),
    // Optional linked redeemable offer (P3 "Canjeados" attribution).
    offer: text("offer", { mode: "json" }).$type<CampaignOffer>(),
    // step "channels" — ordered priority (first reachable wins per recipient).
    channelPriority: text("channel_priority", { mode: "json" }).$type<string[]>(),
    // step "audience" — inline filters (null/{} = everyone).
    audienceFilter: text("audience_filter", { mode: "json" }).$type<CampaignAudienceFilter>(),
    // step "review" — schedule + smart-delivery bypass (P4).
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    special: integer("special", { mode: "boolean" }).notNull().default(false),

    // Dispatch bookkeeping.
    runId: text("run_id"),
    pausedAt: integer("paused_at", { mode: "timestamp" }),
    sentAt: integer("sent_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedAt: integer("published_at", { mode: "timestamp" }),
  },
  (t) => ({
    orgStatusIdx: index("campaign_org_status_idx").on(t.organizationId, t.status),
    orgTypeIdx: index("campaign_org_type_idx").on(t.organizationId, t.type),
  }),
);

export type CampaignRow = typeof campaign.$inferSelect;
export type CampaignInsert = typeof campaign.$inferInsert;

/**
 * `campaign_send` — the per-recipient delivery ledger. One row per resolved
 * recipient of a campaign, written by the dispatch job from the Notifier's
 * per-channel result. This is the backbone for:
 *   - the funnel's "Enviados" (status = "sent"),
 *   - failure control ("Ver error" / "Reintentar" on status = "failed"),
 *   - frequency capping (7-day rolling count per customer — P4),
 *   - later "Clic"/"Canjeados" attribution (P2/P3).
 *
 * Unlike the dev-only outbox tables, this ledger is written in EVERY
 * environment (it's the source of truth for campaign analytics, not a debug log).
 */
export const campaignSend = sqliteTable(
  "campaign_send",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    // The resolved single channel (null when skipped before channel resolution).
    channel: text("channel"),
    // queued | sent | skipped | failed
    status: text("status").notNull().default("queued"),
    // opted-out | no-contact | no-channel | capped (only when status = skipped)
    skipReason: text("skip_reason"),
    // Failure message (only when status = failed) — surfaced by "Ver error".
    error: text("error"),
    providerMessageId: text("provider_message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byCampaign: index("campaign_send_campaign_idx").on(
      t.organizationId,
      t.campaignId,
    ),
    // Powers the rolling 7-day frequency cap (P4).
    byCustomerSentAt: index("campaign_send_customer_sent_idx").on(
      t.organizationId,
      t.customerId,
      t.sentAt,
    ),
    byCampaignStatus: index("campaign_send_campaign_status_idx").on(
      t.campaignId,
      t.status,
    ),
  }),
);

export type CampaignSendRow = typeof campaignSend.$inferSelect;
export type CampaignSendInsert = typeof campaignSend.$inferInsert;

export const campaignRelations = relations(campaign, ({ one, many }) => ({
  organization: one(organization, {
    fields: [campaign.organizationId],
    references: [organization.id],
  }),
  createdBy: one(user, {
    fields: [campaign.createdByUserId],
    references: [user.id],
  }),
  sends: many(campaignSend),
}));

export const campaignSendRelations = relations(campaignSend, ({ one }) => ({
  campaign: one(campaign, {
    fields: [campaignSend.campaignId],
    references: [campaign.id],
  }),
  customer: one(customer, {
    fields: [campaignSend.customerId],
    references: [customer.id],
  }),
}));
