import type { db as Db } from "@loyalty/db";
import {
  campaign,
  campaignSend,
  campaignTemplate,
  category,
  customer,
  loyaltyCard,
  notificationPreference,
  organizationSettings,
  pointsAccount,
  pointsTransaction,
  product,
  promo,
  purchase,
  pushToken,
  promoRedemption,
  redemption,
  reward,
  shortlink,
  shortlinkClick,
  store,
  type CampaignAudienceFilter,
  type CampaignInsert,
  type CampaignRow,
  type CampaignSendInsert,
  type SmartDeliveryRules,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, countDistinct, count, desc, eq, gte, inArray, isNotNull, isNull, like, lte, max, min, sql } from "drizzle-orm";

import { pageCountOf, pageOffset, type ListResult } from "../_shared/list";
import {
  ATTRIBUTION_WINDOW_DAYS,
  ORG_TZ,
  attributedRedemptions,
  countRedeemed,
  type CampaignChannel,
} from "./message";
import type {
  CampaignAnalytics,
  CampaignDisplayState,
  CampaignFailureRow,
  CampaignFunnel,
  CampaignLeaderRow,
  CampaignListItem,
  CampaignSeriesPoint,
  CampaignTimeseries,
  CampaignsListInput,
  SaveTemplateInput,
} from "./schemas";

// ─── Day bucketing (per-day in the org timezone) ─────────────────────────────
const DAY_MS = 86_400_000;
const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ORG_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** YYYY-MM-DD for a date, in the org timezone. */
function dayKey(d: Date): string {
  return dayFmt.format(d);
}
/** Ordered, gap-free day keys from `since` through `now` (inclusive). */
function denseDays(since: Date, now: Date): string[] {
  const days: string[] = [];
  const seen = new Set<string>();
  for (let t = since.getTime(); t <= now.getTime() + DAY_MS; t += DAY_MS) {
    const k = dayKey(new Date(t));
    if (!seen.has(k)) {
      seen.add(k);
      days.push(k);
    }
  }
  return days;
}
type DayTally = { sent: number; clicked: number; redeemed: number };
function bump(map: Map<string, DayTally>, day: string, field: keyof DayTally): void {
  const cur = map.get(day) ?? { sent: 0, clicked: 0, redeemed: 0 };
  cur[field] += 1;
  map.set(day, cur);
}

/** Everything the send job needs per recipient to pick a channel + render vars. */
export interface RecipientFacts {
  customerId: string;
  name: string | null;
  email: string | null;
  phone: string;
  tier: string | null;
  /** Spendable points balance (SUM of the ledger). */
  points: number;
  /** Spendable stamps on the active card. */
  stamps: number;
  reachable: CampaignChannel[];
  optedOut: CampaignChannel[];
}

/** Slice of a campaign a wizard step may write (excludes identity + lifecycle). */
export type CampaignPatch = Partial<
  Pick<
    CampaignInsert,
    | "name"
    | "objective"
    | "message"
    | "offer"
    | "source"
    | "linkUrl"
    | "channelPriority"
    | "audienceFilter"
    | "scheduledAt"
    | "special"
    | "mode"
    | "cooldownDays"
    | "endsAt"
    | "dripIntervalDays"
    | "dripMaxAttempts"
  >
>;

/** Map a notification_preference channel to its campaign channel (or null). */
function toCampaignChannel(channel: string): CampaignChannel | null {
  if (channel === "mail") return "email";
  if (channel === "push" || channel === "sms" || channel === "whatsapp") {
    return channel;
  }
  return null;
}

/** Derive the admin display state from lifecycle + schedule (never stored). */
export function displayState(
  row: CampaignRow,
  now = new Date(),
): CampaignDisplayState {
  if (row.status !== "published") return "draft";
  if (row.mode === "evergreen" || row.mode === "drip") {
    if (row.sendState === "ended" || (row.endsAt && row.endsAt <= now)) return "ended";
    if (row.pausedAt) return "paused";
    return "active";
  }
  if (row.pausedAt) return "paused";
  if (row.sendState === "sent" || row.sentAt) return "sent";
  if (row.scheduledAt && row.scheduledAt > now) return "scheduled";
  return "sending";
}

/**
 * Drizzle access for `campaign` + `campaign_send`. Only layer that touches the
 * db; every read/write is org-scoped. Audience resolution + reachability live
 * here so the `send-campaign` job can reuse them (mirrors `BannersRepository`).
 */
export class CampaignsRepository {
  constructor(private readonly db: typeof Db) {}

  // ── CRUD ────────────────────────────────────────────────────────────────
  async createDraft(orgId: string, userId: string): Promise<CampaignRow> {
    const rows = await this.db
      .insert(campaign)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        type: "promotional",
        status: "draft",
      })
      .returning();
    return this.#first(rows, "insert");
  }

  async findById(orgId: string, id: string): Promise<CampaignRow | null> {
    const rows = await this.db
      .select()
      .from(campaign)
      .where(and(eq(campaign.id, id), eq(campaign.organizationId, orgId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async patch(orgId: string, id: string, patch: CampaignPatch): Promise<CampaignRow> {
    const rows = await this.db
      .update(campaign)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(campaign.id, id), eq(campaign.organizationId, orgId)))
      .returning();
    return this.#first(rows, "patch");
  }

  async markPublished(
    orgId: string,
    id: string,
    values: { scheduledAt: Date | null; special: boolean },
  ): Promise<CampaignRow> {
    const rows = await this.db
      .update(campaign)
      .set({
        status: "published",
        scheduledAt: values.scheduledAt,
        special: values.special,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(campaign.id, id), eq(campaign.organizationId, orgId)))
      .returning();
    return this.#first(rows, "publish");
  }

  async setRun(id: string, runId: string | null): Promise<void> {
    await this.db
      .update(campaign)
      .set({ runId, updatedAt: new Date() })
      .where(eq(campaign.id, id));
  }

  async setSendState(
    id: string,
    sendState: string,
    opts?: { sentAt?: Date | null; pausedAt?: Date | null },
  ): Promise<void> {
    await this.db
      .update(campaign)
      .set({
        sendState,
        ...(opts?.sentAt !== undefined ? { sentAt: opts.sentAt } : {}),
        ...(opts?.pausedAt !== undefined ? { pausedAt: opts.pausedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(campaign.id, id));
  }

  async pause(orgId: string, id: string): Promise<void> {
    await this.db
      .update(campaign)
      .set({ pausedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(campaign.id, id), eq(campaign.organizationId, orgId)));
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(campaign)
      .where(and(eq(campaign.id, id), eq(campaign.organizationId, orgId)));
  }

  async bulkRemove(orgId: string, ids: string[]): Promise<void> {
    await this.db
      .delete(campaign)
      .where(and(eq(campaign.organizationId, orgId), inArray(campaign.id, ids)));
  }

  // ── Admin data-table list ─────────────────────────────────────────────────
  async adminList(
    orgId: string,
    input: CampaignsListInput,
  ): Promise<ListResult<CampaignListItem>> {
    const conds = [eq(campaign.organizationId, orgId)];
    if (input.q) conds.push(like(campaign.name, `%${input.q}%`));
    if (input.type?.length) conds.push(inArray(campaign.type, input.type));
    if (input.createdFrom) conds.push(gte(campaign.createdAt, input.createdFrom));
    if (input.createdTo) conds.push(lte(campaign.createdAt, input.createdTo));

    const all = await this.db.select().from(campaign).where(and(...conds));
    const sentCounts = await this.#sentCounts(all.map((r) => r.id));
    const now = new Date();

    let items: CampaignListItem[] = all.map((r) => ({
      id: r.id,
      name: r.name ?? "Borrador",
      type: r.type,
      status: r.status,
      mode: r.mode,
      displayState: displayState(r, now),
      channelPriority: r.channelPriority ?? [],
      scheduledAt: r.scheduledAt,
      sentAt: r.sentAt,
      sent: sentCounts.get(r.id) ?? 0,
      createdAt: r.createdAt,
    }));

    if (input.state?.length) {
      const set = new Set(input.state);
      items = items.filter((i) => set.has(i.displayState));
    }

    const primary = input.sort[0];
    items.sort((a, b) => {
      const dir = primary?.desc ? -1 : 1;
      if (primary?.id === "name") return a.name.localeCompare(b.name) * dir;
      if (primary?.id === "sent") return (a.sent - b.sent) * dir;
      if (primary?.id === "createdAt")
        return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = items.length;
    const start = pageOffset(input.page, input.perPage);
    return {
      rows: items.slice(start, start + input.perPage),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  async listByIds(orgId: string, ids: string[]): Promise<CampaignListItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(campaign)
      .where(and(eq(campaign.organizationId, orgId), inArray(campaign.id, ids)));
    const sentCounts = await this.#sentCounts(ids);
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? "Borrador",
      type: r.type,
      status: r.status,
      mode: r.mode,
      displayState: displayState(r, now),
      channelPriority: r.channelPriority ?? [],
      scheduledAt: r.scheduledAt,
      sentAt: r.sentAt,
      sent: sentCounts.get(r.id) ?? 0,
      createdAt: r.createdAt,
    }));
  }

  /** Campaigns spawned by a given entity (banner detail "Campañas"). */
  async campaignsForSource(
    orgId: string,
    source: { scope: string; id: string },
  ): Promise<{ id: string; name: string | null; status: string; publishedAt: Date | null }[]> {
    const rows = await this.db
      .select({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        publishedAt: campaign.publishedAt,
        source: campaign.source,
      })
      .from(campaign)
      .where(eq(campaign.organizationId, orgId))
      .orderBy(desc(campaign.createdAt));
    return rows
      .filter((r) => r.source?.scope === source.scope && r.source?.id === source.id)
      .map(({ source: _drop, ...r }) => r);
  }

  async #sentCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ campaignId: campaignSend.campaignId, n: count() })
      .from(campaignSend)
      .where(
        and(inArray(campaignSend.campaignId, ids), eq(campaignSend.status, "sent")),
      )
      .groupBy(campaignSend.campaignId);
    return new Map(rows.map((r) => [r.campaignId, Number(r.n)]));
  }

  // ── Audience resolution + reachability ────────────────────────────────────
  /**
   * Resolve the recipients matching an inline filter, with per-customer
   * reachability (has push token / email / phone) and per-channel marketing
   * opt-outs. Pilot-scale: joins in SQL where cheap, aggregates in memory.
   */
  async resolveRecipients(
    orgId: string,
    filter: CampaignAudienceFilter | null | undefined,
  ): Promise<RecipientFacts[]> {
    const f = filter ?? {};
    const conds = [eq(customer.organizationId, orgId)];
    if (f.signedUpAfter)
      conds.push(gte(customer.createdAt, new Date(f.signedUpAfter)));
    if (f.signedUpBefore)
      conds.push(lte(customer.createdAt, new Date(f.signedUpBefore)));

    const base = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        tier: pointsAccount.currentTierKey,
      })
      .from(customer)
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .where(and(...conds));

    let rows = base;
    if (f.tiers?.length) {
      const set = new Set(f.tiers);
      rows = rows.filter((r) => r.tier != null && set.has(r.tier));
    }

    // Purchase aggregates (count + last) only when a filter needs them.
    if (f.minPurchases != null || f.lastPurchase) {
      const agg = await this.db
        .select({
          customerId: purchase.customerId,
          n: count(),
          last: max(purchase.createdAt),
        })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt)))
        .groupBy(purchase.customerId);
      const byCustomer = new Map(
        agg.map((a) => [a.customerId, { n: Number(a.n), last: a.last }]),
      );
      const now = Date.now();
      rows = rows.filter((r) => {
        const a = byCustomer.get(r.id);
        if (f.minPurchases != null && (a?.n ?? 0) < f.minPurchases) return false;
        if (f.lastPurchase) {
          const last = a?.last?.getTime();
          if (last == null) return f.lastPurchase.op === "gte"; // never bought = "older than"
          const ageDays = (now - last) / 86_400_000;
          if (f.lastPurchase.op === "gte" && ageDays < f.lastPurchase.days) return false;
          if (f.lastPurchase.op === "lte" && ageDays > f.lastPurchase.days) return false;
        }
        return true;
      });
    }

    const ids = rows.map((r) => r.id);
    const [pushSet, optOutMap, pointsMap, stampsMap] = await Promise.all([
      this.#customersWithPush(orgId, ids),
      this.#channelOptOuts(orgId, ids),
      this.#pointsByCustomer(orgId, ids),
      this.#stampsByCustomer(orgId, ids),
    ]);

    return rows.map((r) => {
      const reachable: CampaignChannel[] = ["whatsapp", "sms"]; // phone is notNull
      if (r.email) reachable.push("email");
      if (pushSet.has(r.id)) reachable.push("push");
      return {
        customerId: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        tier: r.tier,
        points: pointsMap.get(r.id) ?? 0,
        stamps: stampsMap.get(r.id) ?? 0,
        reachable,
        optedOut: optOutMap.get(r.id) ?? [],
      };
    });
  }

  /** Points balance per customer (SUM of the signed ledger). */
  async #pointsByCustomer(orgId: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        customerId: pointsTransaction.customerId,
        total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          inArray(pointsTransaction.customerId, ids),
        ),
      )
      .groupBy(pointsTransaction.customerId);
    return new Map(rows.map((r) => [r.customerId, Number(r.total)]));
  }

  /** Spendable stamps per customer (the active card's `currentStamps`). */
  async #stampsByCustomer(orgId: string, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ customerId: loyaltyCard.customerId, stamps: loyaltyCard.currentStamps })
      .from(loyaltyCard)
      .where(
        and(
          eq(loyaltyCard.organizationId, orgId),
          eq(loyaltyCard.status, "active"),
          inArray(loyaltyCard.customerId, ids),
        ),
      );
    return new Map(rows.map((r) => [r.customerId, Number(r.stamps ?? 0)]));
  }

  async #customersWithPush(orgId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db
      .selectDistinct({ id: pushToken.customerId })
      .from(pushToken)
      .where(
        and(
          eq(pushToken.organizationId, orgId),
          eq(pushToken.isActive, true),
          inArray(pushToken.customerId, ids),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  async #channelOptOuts(
    orgId: string,
    ids: string[],
  ): Promise<Map<string, CampaignChannel[]>> {
    const map = new Map<string, CampaignChannel[]>();
    if (ids.length === 0) return map;
    const rows = await this.db
      .select({
        customerId: notificationPreference.customerId,
        channel: notificationPreference.channel,
      })
      .from(notificationPreference)
      .where(
        and(
          eq(notificationPreference.organizationId, orgId),
          eq(notificationPreference.marketingEnabled, false),
          inArray(notificationPreference.customerId, ids),
        ),
      );
    for (const r of rows) {
      const c = toCampaignChannel(r.channel);
      if (!c) continue;
      const arr = map.get(r.customerId) ?? [];
      arr.push(c);
      map.set(r.customerId, arr);
    }
    return map;
  }

  // ── Template entity resolution (merge variables) ──────────────────────────
  /** The org's primary store display name (for `{{store.name}}`). */
  /** Store fields for `{{store.*}}` — phone/social fall back to org settings. */
  async storeInfo(
    orgId: string,
  ): Promise<{ name: string; address: string; phone: string; instagram: string }> {
    const [s] = await this.db
      .select({
        name: store.name,
        address: store.address,
        phone: store.phone,
        social: store.socialLinks,
      })
      .from(store)
      .where(eq(store.organizationId, orgId))
      .limit(1);
    const [os] = await this.db
      .select({
        phone: organizationSettings.phone,
        social: organizationSettings.socialLinks,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);
    return {
      name: s?.name ?? "",
      address: s?.address ?? "",
      phone: s?.phone ?? os?.phone ?? "",
      instagram: s?.social?.instagram ?? os?.social?.instagram ?? "",
    };
  }

  /**
   * Resolve `{{entity#id.field}}` references to their name + customer-app URL,
   * keyed by `"${scope}#${id}"`. Same entity for all recipients → resolved once.
   */
  async resolveEntityRefs(
    orgId: string,
    refs: ReadonlyArray<{ scope: "promo" | "product" | "reward" | "category"; id: string }>,
  ): Promise<Map<string, { name: string; url: string | null }>> {
    const map = new Map<string, { name: string; url: string | null }>();
    const ids = (s: string) => refs.filter((r) => r.scope === s).map((r) => r.id);

    const promoIds = ids("promo");
    if (promoIds.length) {
      const rows = await this.db
        .select({ id: promo.id, name: promo.name, slug: promo.slug })
        .from(promo)
        .where(and(eq(promo.organizationId, orgId), inArray(promo.id, promoIds)));
      for (const r of rows)
        map.set(`promo#${r.id}`, { name: r.name ?? "", url: r.slug ? `/promos/${r.slug}` : null });
    }
    const productIds = ids("product");
    if (productIds.length) {
      const rows = await this.db
        .select({ id: product.id, name: product.name, slug: product.slug })
        .from(product)
        .where(and(eq(product.organizationId, orgId), inArray(product.id, productIds)));
      for (const r of rows)
        map.set(`product#${r.id}`, { name: r.name, url: `/product/${r.slug}` });
    }
    const rewardIds = ids("reward");
    if (rewardIds.length) {
      const rows = await this.db
        .select({ id: reward.id, name: reward.name })
        .from(reward)
        .where(and(eq(reward.organizationId, orgId), inArray(reward.id, rewardIds)));
      for (const r of rows) map.set(`reward#${r.id}`, { name: r.name, url: `/rewards` });
    }
    const categoryIds = ids("category");
    if (categoryIds.length) {
      const rows = await this.db
        .select({ id: category.id, name: category.name, slug: category.slug })
        .from(category)
        .where(and(eq(category.organizationId, orgId), inArray(category.id, categoryIds)));
      for (const r of rows)
        map.set(`category#${r.id}`, { name: r.name, url: `/menu?category=${r.slug}` });
    }
    return map;
  }

  // ── Smart-delivery rules ───────────────────────────────────────────────────
  async getSmartDelivery(orgId: string): Promise<SmartDeliveryRules | null> {
    const rows = await this.db
      .select({ rules: organizationSettings.smartDelivery })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);
    return rows[0]?.rules ?? null;
  }

  // ── Ledger ────────────────────────────────────────────────────────────────
  async recordSend(row: CampaignSendInsert): Promise<void> {
    await this.db.insert(campaignSend).values(row);
  }

  async clearSends(campaignId: string, statuses: string[]): Promise<void> {
    await this.db
      .delete(campaignSend)
      .where(
        and(
          eq(campaignSend.campaignId, campaignId),
          inArray(campaignSend.status, statuses),
        ),
      );
  }

  /** Rolling count of successful promotional sends to a customer since `since`. */
  async recentSendCount(
    orgId: string,
    customerId: string,
    since: Date,
  ): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.customerId, customerId),
          eq(campaignSend.status, "sent"),
          gte(campaignSend.sentAt, since),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  }

  // ── Recurring (evergreen + drip) ──────────────────────────────────────────
  /** Live campaigns of a given mode due for a cron pulse (not paused/ended). */
  async listActiveByMode(
    orgId: string,
    mode: string,
    now = new Date(),
  ): Promise<CampaignRow[]> {
    const rows = await this.db
      .select()
      .from(campaign)
      .where(
        and(
          eq(campaign.organizationId, orgId),
          eq(campaign.status, "published"),
          eq(campaign.mode, mode),
        ),
      );
    return rows.filter(
      (r) => !r.pausedAt && r.sendState !== "ended" && (!r.endsAt || r.endsAt > now),
    );
  }

  /**
   * Drip re-insistence targets: cohort members (from the ledger) who are due
   * (last send ≥ interval ago), under the attempt cap, and haven't purchased
   * since their first send.
   */
  async resolveDripDue(orgId: string, camp: CampaignRow, now = new Date()): Promise<string[]> {
    const interval = camp.dripIntervalDays ?? 3;
    const maxAttempts = camp.dripMaxAttempts ?? 3;
    const sends = await this.db
      .select({
        customerId: campaignSend.customerId,
        first: min(campaignSend.sentAt),
        last: max(campaignSend.sentAt),
        n: count(),
      })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, camp.id),
          eq(campaignSend.status, "sent"),
        ),
      )
      .groupBy(campaignSend.customerId);

    const dueBy = new Date(now.getTime() - interval * 86_400_000);
    const candidates = sends.filter(
      (s) => Number(s.n) < maxAttempts && s.last != null && s.last <= dueBy,
    );
    if (candidates.length === 0) return [];

    const ids = candidates.map((c) => c.customerId);
    const purchases = await this.db
      .select({ customerId: purchase.customerId, last: max(purchase.createdAt) })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          inArray(purchase.customerId, ids),
          isNull(purchase.voidedAt),
        ),
      )
      .groupBy(purchase.customerId);
    const lastPurchase = new Map(purchases.map((p) => [p.customerId, p.last]));

    // Converted = a purchase at/after their first drip send → drop from the drip.
    return candidates
      .filter((c) => {
        const lp = lastPurchase.get(c.customerId);
        return !(lp && c.first && lp >= c.first);
      })
      .map((c) => c.customerId);
  }

  /** Evergreen matchers minus anyone with a successful send inside the cooldown. */
  async resolveEligibleRecipients(
    orgId: string,
    camp: CampaignRow,
    now = new Date(),
  ): Promise<RecipientFacts[]> {
    const matchers = await this.resolveRecipients(orgId, camp.audienceFilter);
    const since = new Date(now.getTime() - (camp.cooldownDays ?? 0) * 86_400_000);
    const sent = await this.db
      .selectDistinct({ id: campaignSend.customerId })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, camp.id),
          eq(campaignSend.status, "sent"),
          gte(campaignSend.sentAt, since),
        ),
      );
    const onCooldown = new Set(sent.map((r) => r.id));
    return matchers.filter((r) => !onCooldown.has(r.customerId));
  }

  async activateEvergreen(orgId: string, id: string, at: Date): Promise<void> {
    await this.db
      .update(campaign)
      .set({ activatedAt: at, sendState: "active" })
      .where(and(eq(campaign.organizationId, orgId), eq(campaign.id, id)));
  }

  async endEvergreen(orgId: string, id: string): Promise<void> {
    await this.db
      .update(campaign)
      .set({ sendState: "ended" })
      .where(and(eq(campaign.organizationId, orgId), eq(campaign.id, id)));
  }

  async resume(orgId: string, id: string): Promise<CampaignRow> {
    const rows = await this.db
      .update(campaign)
      .set({ pausedAt: null })
      .where(and(eq(campaign.organizationId, orgId), eq(campaign.id, id)))
      .returning();
    return this.#first(rows, "resume");
  }

  async setLastPulse(campaignId: string, at: Date): Promise<void> {
    await this.db
      .update(campaign)
      .set({ lastPulseAt: at })
      .where(eq(campaign.id, campaignId));
  }

  // ── Funnel + failures ───────────────────────────────────────────────────────
  async funnel(orgId: string, campaign: CampaignRow): Promise<CampaignFunnel> {
    const campaignId = campaign.id;
    const rows = await this.db
      .select({
        status: campaignSend.status,
        skipReason: campaignSend.skipReason,
        channel: campaignSend.channel,
        n: count(),
      })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, campaignId),
        ),
      )
      .groupBy(campaignSend.status, campaignSend.skipReason, campaignSend.channel);

    const funnel: CampaignFunnel = {
      sent: 0,
      clicked: 0,
      redeemed: null,
      skipped: 0,
      failed: 0,
      skipReasons: {},
      byChannel: {},
    };
    for (const r of rows) {
      const n = Number(r.n);
      if (r.status === "sent") {
        funnel.sent += n;
        if (r.channel) funnel.byChannel[r.channel] = (funnel.byChannel[r.channel] ?? 0) + n;
      } else if (r.status === "failed") {
        funnel.failed += n;
      } else if (r.status === "skipped") {
        funnel.skipped += n;
        const reason = r.skipReason ?? "unknown";
        funnel.skipReasons[reason] = (funnel.skipReasons[reason] ?? 0) + n;
      }
    }
    [funnel.clicked, funnel.redeemed] = await Promise.all([
      this.clickedCount(orgId, campaignId),
      this.redeemedCount(orgId, campaign),
    ]);
    return funnel;
  }

  /**
   * Distinct recipients who redeemed the campaign's linked offer within the
   * attribution window after their send. Inferred (offer + customer + time) —
   * no attribution column on the redemption write path. Null when no offer.
   */
  /** First-send-per-customer + this offer's redemptions (for attribution). */
  async #redemptionInputs(
    orgId: string,
    campaign: CampaignRow,
  ): Promise<{
    sentAtByCustomer: Map<string, Date>;
    redemptions: { customerId: string; at: Date }[];
  } | null> {
    const offer = campaign.offer;
    if (!offer) return null;

    const sentRows = await this.db
      .select({ customerId: campaignSend.customerId, sentAt: campaignSend.sentAt })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, campaign.id),
          eq(campaignSend.status, "sent"),
        ),
      );
    const sentAtByCustomer = new Map<string, Date>();
    for (const r of sentRows) {
      if (!r.sentAt) continue;
      const prev = sentAtByCustomer.get(r.customerId);
      if (!prev || r.sentAt < prev) sentAtByCustomer.set(r.customerId, r.sentAt);
    }

    const redemptions =
      offer.kind === "promo"
        ? (
            await this.db
              .select({
                customerId: promoRedemption.customerId,
                at: promoRedemption.appliedAt,
              })
              .from(promoRedemption)
              .where(eq(promoRedemption.promoId, offer.id))
          ).map((r) => ({ customerId: r.customerId, at: r.at }))
        : (
            await this.db
              .select({
                customerId: redemption.customerId,
                at: redemption.createdAt,
              })
              .from(redemption)
              .where(
                and(
                  eq(redemption.organizationId, orgId),
                  eq(redemption.rewardId, offer.id),
                ),
              )
          )
            .filter((r): r is { customerId: string; at: Date } => r.customerId != null)
            .map((r) => ({ customerId: r.customerId, at: r.at }));

    return { sentAtByCustomer, redemptions };
  }

  async redeemedCount(orgId: string, campaign: CampaignRow): Promise<number | null> {
    const inp = await this.#redemptionInputs(orgId, campaign);
    if (!inp) return null;
    if (inp.sentAtByCustomer.size === 0) return 0;
    return countRedeemed(
      inp.sentAtByCustomer,
      inp.redemptions,
      ATTRIBUTION_WINDOW_DAYS * DAY_MS,
    );
  }

  /** Distinct recipients who clicked a per-recipient shortlink of this campaign. */
  async clickedCount(orgId: string, campaignId: string): Promise<number> {
    const rows = await this.db
      .select({ n: countDistinct(shortlink.customerId) })
      .from(shortlinkClick)
      .innerJoin(shortlink, eq(shortlink.id, shortlinkClick.shortlinkId))
      .where(
        and(
          eq(shortlink.organizationId, orgId),
          eq(shortlink.campaignId, campaignId),
          isNotNull(shortlink.customerId),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  }

  // ── Analytics (honest signals: sent → clicked → redeemed) ─────────────────
  /** Org-level campaign analytics over a lookback window (dashboard + hub). */
  async analytics(orgId: string, sinceMs: number): Promise<CampaignAnalytics> {
    const now = new Date();
    const since = new Date(now.getTime() - sinceMs);

    const sent = await this.db
      .select({
        campaignId: campaignSend.campaignId,
        channel: campaignSend.channel,
        sentAt: campaignSend.sentAt,
      })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.status, "sent"),
          gte(campaignSend.sentAt, since),
        ),
      );
    const clicks = await this.db
      .select({
        campaignId: shortlink.campaignId,
        customerId: shortlink.customerId,
        clickedAt: shortlinkClick.clickedAt,
      })
      .from(shortlinkClick)
      .innerJoin(shortlink, eq(shortlink.id, shortlinkClick.shortlinkId))
      .where(
        and(
          eq(shortlink.organizationId, orgId),
          isNotNull(shortlink.campaignId),
          isNotNull(shortlink.customerId),
          gte(shortlinkClick.clickedAt, since),
        ),
      );

    const campIds = [...new Set(sent.map((s) => s.campaignId))];
    const camps =
      campIds.length > 0
        ? await this.db
            .select()
            .from(campaign)
            .where(and(eq(campaign.organizationId, orgId), inArray(campaign.id, campIds)))
        : [];

    const seriesMap = new Map<string, DayTally>();
    const byChannel: Record<string, number> = {};
    const sentByCampaign = new Map<string, number>();
    for (const s of sent) {
      if (!s.sentAt) continue;
      bump(seriesMap, dayKey(s.sentAt), "sent");
      if (s.channel) byChannel[s.channel] = (byChannel[s.channel] ?? 0) + 1;
      sentByCampaign.set(s.campaignId, (sentByCampaign.get(s.campaignId) ?? 0) + 1);
    }

    // Clicked = distinct recipient (per campaign) — daily dedups by day+campaign+customer.
    const clickedByCampaign = new Map<string, Set<string>>();
    const clickDaySeen = new Set<string>();
    for (const c of clicks) {
      if (!c.customerId || !c.campaignId) continue;
      const day = dayKey(c.clickedAt);
      const dk = `${day}|${c.campaignId}|${c.customerId}`;
      if (!clickDaySeen.has(dk)) {
        clickDaySeen.add(dk);
        bump(seriesMap, day, "clicked");
      }
      let set = clickedByCampaign.get(c.campaignId);
      if (!set) {
        set = new Set();
        clickedByCampaign.set(c.campaignId, set);
      }
      set.add(c.customerId);
    }

    // Redeemed = attributed redemptions (offer-linked campaigns), bucketed by day.
    let totalRedeemed = 0;
    const redeemedByCampaign = new Map<string, number>();
    for (const c of camps) {
      if (!c.offer) continue;
      const inp = await this.#redemptionInputs(orgId, c);
      if (!inp || inp.sentAtByCustomer.size === 0) continue;
      const dates = attributedRedemptions(
        inp.sentAtByCustomer,
        inp.redemptions,
        ATTRIBUTION_WINDOW_DAYS * DAY_MS,
      );
      redeemedByCampaign.set(c.id, dates.length);
      totalRedeemed += dates.length;
      for (const d of dates) if (d >= since) bump(seriesMap, dayKey(d), "redeemed");
    }

    const series: CampaignSeriesPoint[] = denseDays(since, now).map((day) => ({
      day,
      ...(seriesMap.get(day) ?? { sent: 0, clicked: 0, redeemed: 0 }),
    }));

    const totalSent = sent.length;
    const totalClicked = [...clickedByCampaign.values()].reduce((a, s) => a + s.size, 0);
    const nameById = new Map(camps.map((c) => [c.id, c.name]));
    const leaderboard: CampaignLeaderRow[] = campIds
      .map((id) => {
        const s = sentByCampaign.get(id) ?? 0;
        const cl = clickedByCampaign.get(id)?.size ?? 0;
        return {
          id,
          name: nameById.get(id) ?? "—",
          sent: s,
          clickRate: s > 0 ? cl / s : 0,
          redeemed: redeemedByCampaign.get(id) ?? 0,
        };
      })
      .sort((a, b) => b.clickRate - a.clickRate || b.sent - a.sent)
      .slice(0, 8);

    return {
      kpis: {
        sent: totalSent,
        clickRate: totalSent > 0 ? totalClicked / totalSent : 0,
        redeemed: totalRedeemed,
        active: await this.#activeCampaignCount(orgId, now),
      },
      series,
      byChannel,
      leaderboard,
    };
  }

  async #activeCampaignCount(orgId: string, now: Date): Promise<number> {
    const rows = await this.db
      .select()
      .from(campaign)
      .where(and(eq(campaign.organizationId, orgId), eq(campaign.status, "published")));
    return rows.filter((r) => {
      const s = displayState(r, now);
      return s === "active" || s === "sending" || s === "scheduled";
    }).length;
  }

  /** Per-campaign time-series (+ drip per-attempt breakdown). */
  async campaignTimeseries(orgId: string, camp: CampaignRow): Promise<CampaignTimeseries> {
    const now = new Date();
    const sent = await this.db
      .select({ customerId: campaignSend.customerId, sentAt: campaignSend.sentAt })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, camp.id),
          eq(campaignSend.status, "sent"),
        ),
      );
    const clicks = await this.db
      .select({ customerId: shortlink.customerId, clickedAt: shortlinkClick.clickedAt })
      .from(shortlinkClick)
      .innerJoin(shortlink, eq(shortlink.id, shortlinkClick.shortlinkId))
      .where(
        and(
          eq(shortlink.organizationId, orgId),
          eq(shortlink.campaignId, camp.id),
          isNotNull(shortlink.customerId),
        ),
      );

    let first: Date | null = null;
    const seriesMap = new Map<string, DayTally>();
    const firstByCustomer = new Map<string, Date>();
    const attemptsByCustomer = new Map<string, number>();
    for (const s of sent) {
      if (!s.sentAt) continue;
      bump(seriesMap, dayKey(s.sentAt), "sent");
      if (!first || s.sentAt < first) first = s.sentAt;
      const prev = firstByCustomer.get(s.customerId);
      if (!prev || s.sentAt < prev) firstByCustomer.set(s.customerId, s.sentAt);
      attemptsByCustomer.set(s.customerId, (attemptsByCustomer.get(s.customerId) ?? 0) + 1);
    }
    const clickDaySeen = new Set<string>();
    for (const c of clicks) {
      if (!c.customerId) continue;
      const day = dayKey(c.clickedAt);
      const dk = `${day}|${c.customerId}`;
      if (!clickDaySeen.has(dk)) {
        clickDaySeen.add(dk);
        bump(seriesMap, day, "clicked");
      }
    }
    const inp = await this.#redemptionInputs(orgId, camp);
    if (inp && inp.sentAtByCustomer.size > 0) {
      for (const d of attributedRedemptions(
        inp.sentAtByCustomer,
        inp.redemptions,
        ATTRIBUTION_WINDOW_DAYS * DAY_MS,
      )) {
        bump(seriesMap, dayKey(d), "redeemed");
      }
    }

    const start = first ?? camp.createdAt;
    const series: CampaignSeriesPoint[] = denseDays(start, now).map((day) => ({
      day,
      ...(seriesMap.get(day) ?? { sent: 0, clicked: 0, redeemed: 0 }),
    }));

    let attempts: CampaignTimeseries["attempts"] = null;
    if (camp.mode === "drip") {
      const ids = [...attemptsByCustomer.keys()];
      const purchases =
        ids.length > 0
          ? await this.db
              .select({ customerId: purchase.customerId, last: max(purchase.createdAt) })
              .from(purchase)
              .where(
                and(
                  eq(purchase.organizationId, orgId),
                  inArray(purchase.customerId, ids),
                  isNull(purchase.voidedAt),
                ),
              )
              .groupBy(purchase.customerId)
          : [];
      const lastPurchase = new Map(purchases.map((p) => [p.customerId, p.last]));
      const maxAtt = camp.dripMaxAttempts ?? 3;
      const buckets = Array.from({ length: maxAtt }, () => ({ recipients: 0, converted: 0 }));
      for (const [cust, n] of attemptsByCustomer) {
        const bucket = buckets[Math.min(n, maxAtt) - 1]!;
        bucket.recipients += 1;
        const lp = lastPurchase.get(cust);
        const fs = firstByCustomer.get(cust);
        if (lp && fs && lp >= fs) bucket.converted += 1;
      }
      attempts = buckets.map((b, i) => ({ attempt: i + 1, ...b }));
    }

    return { series, attempts };
  }

  async listFailures(orgId: string, campaignId: string): Promise<CampaignFailureRow[]> {
    const rows = await this.db
      .select({
        id: campaignSend.id,
        customerId: campaignSend.customerId,
        channel: campaignSend.channel,
        error: campaignSend.error,
        createdAt: campaignSend.createdAt,
      })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, campaignId),
          eq(campaignSend.status, "failed"),
        ),
      )
      .orderBy(desc(campaignSend.createdAt));
    return rows;
  }

  async failedRecipientIds(orgId: string, campaignId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ id: campaignSend.customerId })
      .from(campaignSend)
      .where(
        and(
          eq(campaignSend.organizationId, orgId),
          eq(campaignSend.campaignId, campaignId),
          eq(campaignSend.status, "failed"),
        ),
      );
    return rows.map((r) => r.id);
  }

  // ─── Saved templates ──────────────────────────────────────────────────────
  async listTemplates(orgId: string) {
    return this.db
      .select({
        id: campaignTemplate.id,
        name: campaignTemplate.name,
        message: campaignTemplate.message,
        channelPriority: campaignTemplate.channelPriority,
        updatedAt: campaignTemplate.updatedAt,
      })
      .from(campaignTemplate)
      .where(eq(campaignTemplate.organizationId, orgId))
      .orderBy(desc(campaignTemplate.updatedAt));
  }

  async createTemplate(
    orgId: string,
    userId: string,
    input: SaveTemplateInput,
  ): Promise<{ id: string }> {
    const [row] = await this.db
      .insert(campaignTemplate)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        name: input.name,
        message: input.message,
        channelPriority: input.channelPriority ?? null,
      })
      .returning({ id: campaignTemplate.id });
    if (!row) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "createTemplate returned no row",
      });
    }
    return row;
  }

  async deleteTemplate(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(campaignTemplate)
      .where(
        and(
          eq(campaignTemplate.organizationId, orgId),
          eq(campaignTemplate.id, id),
        ),
      );
  }

  #first(rows: CampaignRow[], op: string): CampaignRow {
    const row = rows[0];
    if (!row) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `campaign ${op} returned no row`,
      });
    }
    return row;
  }
}
