import type { db as Db } from "@loyalty/db";
import {
  auditLog,
  campaignSend,
  customer,
  loyaltyCard,
  notification,
  pointsAccount,
  pointsTransaction,
  product,
  purchase,
  purchaseItem,
  redemption,
  reward,
  stamp,
  store,
  user,
} from "@loyalty/db/schema";
import {
  and,
  asc,
  type Column,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";

import { buildOrderBy, type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type {
  CheckAvailabilityInput,
  CustomerDetail,
  CustomerListItem,
  CustomersKpis,
  CustomersListInput,
  CustomerStats,
  LedgerInput,
  LedgerView,
  PointsLedgerRow,
  RedemptionHistoryRow,
  StampsHistoryRow,
  TimelineEvent,
  TimelineInput,
  TimelineView,
} from "./schemas";

const DAY = 86_400_000;

/** `mode:"timestamp"` columns are stored as unix SECONDS. Raw `sql`/`max()`
 *  reads return that integer (drizzle only auto-converts typed column selects),
 *  so convert seconds↔Date/ms explicitly around raw expressions. */
const secToDate = (s: number | null): Date | null => (s == null ? null : new Date(Number(s) * 1000));
const toUnixSec = (d: Date): number => Math.floor(d.getTime() / 1000);

export interface CustomerSearchItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  nickname: string | null;
  tierKey: string | null;
}

const SORTABLE = {
  name: customer.name,
  createdAt: customer.createdAt,
};

/** Drizzle access for customers — the cashier picker + the admin CRM. Only
 *  layer that touches the db; org-scoped. Sales aggregates exclude voided. */
export class CustomersRepository {
  constructor(private readonly db: typeof Db) {}

  // ── cashier picker ─────────────────────────────────────────────────────────
  async search(organizationId: string, query: string, limit: number): Promise<CustomerSearchItem[]> {
    const q = query.trim();
    const where = q
      ? and(
          eq(customer.organizationId, organizationId),
          or(
            like(customer.name, `%${q}%`),
            like(customer.phone, `%${q}%`),
            like(customer.email, `%${q}%`),
            like(customer.nickname, `%${q}%`),
          ),
        )
      : eq(customer.organizationId, organizationId);

    return this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        nickname: customer.nickname,
        tierKey: pointsAccount.currentTierKey,
      })
      .from(customer)
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .where(where)
      .orderBy(desc(customer.createdAt))
      .limit(limit);
  }

  // ── admin list ─────────────────────────────────────────────────────────────
  async adminList(
    orgId: string,
    input: CustomersListInput,
    now = new Date(),
  ): Promise<ListResult<CustomerListItem>> {
    const where = this.listWhere(orgId, input);
    const having = this.listHaving(input, now);
    // Aggregates (visits/ltv/lastVisit) come from a grouped left-join over the
    // customer's non-voided purchases.
    const visits = sql<number>`count(${purchase.id})`;
    const ltv = sql<number>`coalesce(sum(${purchase.priceCents}), 0)`;
    const lastVisit = sql<number | null>`max(${purchase.createdAt})`;

    const orderBy = this.listOrderBy(input.sort, { visits, ltv, lastVisit });

    const rows = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        tierKey: pointsAccount.currentTierKey,
        banned: user.banned,
        visits,
        ltv,
        lastVisit,
        createdAt: customer.createdAt,
      })
      .from(customer)
      .leftJoin(user, eq(user.id, customer.id))
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .leftJoin(purchase, and(eq(purchase.customerId, customer.id), isNull(purchase.voidedAt)))
      .where(where)
      .groupBy(customer.id)
      .having(having)
      .orderBy(...orderBy)
      .limit(input.perPage)
      .offset(pageOffset(input.page, input.perPage));

    // total honors the same filters (count over the grouped set).
    const totalRows = await this.db
      .select({ id: customer.id })
      .from(customer)
      .leftJoin(user, eq(user.id, customer.id))
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .leftJoin(purchase, and(eq(purchase.customerId, customer.id), isNull(purchase.voidedAt)))
      .where(where)
      .groupBy(customer.id)
      .having(having);

    const items: CustomerListItem[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      tierKey: r.tierKey,
      banned: r.banned === true,
      visits: Number(r.visits),
      ltvCents: Number(r.ltv),
      lastVisitAt: secToDate(r.lastVisit),
      createdAt: r.createdAt,
    }));
    return { rows: items, total: totalRows.length, pageCount: pageCountOf(totalRows.length, input.perPage) };
  }

  async listByIds(orgId: string, ids: string[]): Promise<CustomerListItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        tierKey: pointsAccount.currentTierKey,
        banned: user.banned,
        visits: sql<number>`count(${purchase.id})`,
        ltv: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
        lastVisit: sql<number | null>`max(${purchase.createdAt})`,
        createdAt: customer.createdAt,
      })
      .from(customer)
      .leftJoin(user, eq(user.id, customer.id))
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .leftJoin(purchase, and(eq(purchase.customerId, customer.id), isNull(purchase.voidedAt)))
      .where(and(eq(customer.organizationId, orgId), inArray(customer.id, ids)))
      .groupBy(customer.id);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      tierKey: r.tierKey,
      banned: r.banned === true,
      visits: Number(r.visits),
      ltvCents: Number(r.ltv),
      lastVisitAt: secToDate(r.lastVisit),
      createdAt: r.createdAt,
    }));
  }

  async adminKpis(orgId: string, now = new Date()): Promise<CustomersKpis> {
    const since = new Date(now.getTime() - 30 * DAY);
    const [totals, actives, ltvs] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)`,
          new30d: sql<number>`coalesce(sum(case when ${customer.createdAt} >= ${toUnixSec(since)} then 1 else 0 end), 0)`,
        })
        .from(customer)
        .where(eq(customer.organizationId, orgId)),
      this.db
        .select({ v: sql<number>`count(distinct ${purchase.customerId})` })
        .from(purchase)
        .where(
          and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt), gte(purchase.createdAt, since)),
        ),
      this.db
        .select({ ltv: sql<number>`coalesce(sum(${purchase.priceCents}), 0)` })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt))),
    ]);
    const total = Number(totals[0]?.total ?? 0);
    const totalLtv = Number(ltvs[0]?.ltv ?? 0);
    return {
      total,
      new30d: Number(totals[0]?.new30d ?? 0),
      active30d: Number(actives[0]?.v ?? 0),
      avgLtvCents: total > 0 ? Math.round(totalLtv / total) : 0,
    };
  }

  // ── detail ───────────────────────────────────────────────────────────────
  async adminGet(orgId: string, id: string, now = new Date()): Promise<CustomerDetail | null> {
    const rows = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        nickname: customer.nickname,
        avatarPreset: customer.avatarPreset,
        avatarUrl: customer.avatarUrl,
        birthday: customer.birthday,
        createdAt: customer.createdAt,
        tierKey: pointsAccount.currentTierKey,
        banned: user.banned,
        banReason: user.banReason,
      })
      .from(customer)
      .leftJoin(user, eq(user.id, customer.id))
      .leftJoin(pointsAccount, eq(pointsAccount.customerId, customer.id))
      .where(and(eq(customer.organizationId, orgId), eq(customer.id, id)))
      .limit(1);
    const c = rows[0];
    if (!c) return null;
    const lastVisitAt = await this.lastVisit(orgId, id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      nickname: c.nickname,
      avatarPreset: c.avatarPreset,
      avatarUrl: c.avatarUrl,
      birthday: c.birthday ?? null,
      tierKey: c.tierKey,
      createdAt: c.createdAt,
      banned: c.banned === true,
      banReason: c.banReason ?? null,
      lastVisitAt,
      daysSinceLastVisit: lastVisitAt ? Math.floor((now.getTime() - lastVisitAt.getTime()) / DAY) : null,
    };
  }

  private async lastVisit(orgId: string, customerId: string): Promise<Date | null> {
    const rows = await this.db
      .select({ at: sql<number | null>`max(${purchase.createdAt})` })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
          isNull(purchase.voidedAt),
        ),
      );
    const at = rows[0]?.at;
    return secToDate(at ?? null);
  }

  // ── stats (overview tab) ────────────────────────────────────────────────────
  async stats(orgId: string, customerId: string, now = new Date()): Promise<CustomerStats> {
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [agg, dates, monthlyRows, favStore, topProd, percentile, created] = await Promise.all([
      this.db
        .select({
          visits: sql<number>`count(*)`,
          ltv: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
        })
        .from(purchase)
        .where(scope(orgId, customerId)),
      this.db
        .select({ createdAt: purchase.createdAt })
        .from(purchase)
        .where(scope(orgId, customerId))
        .orderBy(asc(purchase.createdAt)),
      this.db
        .select({
          month: sql<string>`strftime('%Y-%m', ${purchase.createdAt}, 'unixepoch')`,
          spend: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
          visits: sql<number>`count(*)`,
        })
        .from(purchase)
        .where(and(scope(orgId, customerId), gte(purchase.createdAt, sixMonthsAgo)))
        .groupBy(sql`1`),
      this.db
        .select({ storeId: purchase.storeId, name: store.name, visits: sql<number>`count(*)` })
        .from(purchase)
        .leftJoin(store, eq(store.id, purchase.storeId))
        .where(scope(orgId, customerId))
        .groupBy(purchase.storeId)
        .orderBy(desc(sql`count(*)`))
        .limit(1),
      this.db
        .select({ productId: purchaseItem.productId, name: product.name, qty: sql<number>`sum(${purchaseItem.qty})` })
        .from(purchaseItem)
        .innerJoin(purchase, eq(purchase.id, purchaseItem.purchaseId))
        .leftJoin(product, eq(product.id, purchaseItem.productId))
        .where(scope(orgId, customerId))
        .groupBy(purchaseItem.productId)
        .orderBy(desc(sql`sum(${purchaseItem.qty})`))
        .limit(1),
      this.spendPercentile(orgId, customerId),
      this.db
        .select({ createdAt: customer.createdAt })
        .from(customer)
        .where(eq(customer.id, customerId))
        .limit(1),
    ]);

    const visits = Number(agg[0]?.visits ?? 0);
    const ltvCents = Number(agg[0]?.ltv ?? 0);
    const ds = dates.map((d) => d.createdAt.getTime()).sort((a, b) => a - b);
    let avgDaysBetween: number | null = null;
    if (ds.length >= 2) {
      const spanDays = (ds[ds.length - 1]! - ds[0]!) / DAY;
      avgDaysBetween = Math.round(spanDays / (ds.length - 1));
    }
    const lastVisitAt = ds.length > 0 ? new Date(ds[ds.length - 1]!) : null;

    // Pre-seed the last 6 months so the charts have no gaps.
    const monthly: CustomerStats["monthly"] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = monthlyRows.find((m) => m.month === key);
      monthly.push({ month: key, spendCents: Number(row?.spend ?? 0), visits: Number(row?.visits ?? 0) });
    }

    const fav = favStore[0];
    const prod = topProd[0];
    return {
      ltvCents,
      avgTicketCents: visits > 0 ? Math.round(ltvCents / visits) : 0,
      visits,
      avgDaysBetween,
      daysSinceLastVisit: lastVisitAt ? Math.floor((now.getTime() - lastVisitAt.getTime()) / DAY) : null,
      memberSince: created[0]?.createdAt ?? now,
      spendPercentile: percentile,
      monthly,
      favoriteStore: fav ? { id: fav.storeId ?? "", name: fav.name ?? null, visits: Number(fav.visits) } : null,
      topProduct: prod ? { productId: prod.productId, name: prod.name ?? null, qty: Number(prod.qty) } : null,
    };
  }

  /** Percentile of this customer's lifetime spend among org customers (0-100).
   *  Small pilot scale → aggregate all customers' spend and rank in memory. */
  private async spendPercentile(orgId: string, customerId: string): Promise<number | null> {
    const rows = await this.db
      .select({
        customerId: purchase.customerId,
        ltv: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
      })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt)))
      .groupBy(purchase.customerId);
    if (rows.length === 0) return null;
    const mine = rows.find((r) => r.customerId === customerId);
    if (!mine) return null;
    const below = rows.filter((r) => Number(r.ltv) < Number(mine.ltv)).length;
    return Math.round((below / rows.length) * 100);
  }

  // ── loyalty tab: staff-scoped ledgers ────────────────────────────────────────
  async pointsLedger(orgId: string, input: LedgerInput): Promise<LedgerView<PointsLedgerRow>> {
    const conds = [
      eq(pointsTransaction.organizationId, orgId),
      eq(pointsTransaction.customerId, input.customerId),
    ];
    this.pushCursor(conds, pointsTransaction.createdAt, input.cursor);
    const rows = await this.db
      .select({
        id: pointsTransaction.id,
        type: pointsTransaction.type,
        points: pointsTransaction.points,
        reason: pointsTransaction.reason,
        createdAt: pointsTransaction.createdAt,
      })
      .from(pointsTransaction)
      .where(and(...conds))
      .orderBy(desc(pointsTransaction.createdAt))
      .limit(input.limit + 1);
    return this.paginate(rows, input.limit, (r) => ({
      id: r.id,
      type: r.type as PointsLedgerRow["type"],
      points: r.points,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  async stampsHistory(orgId: string, input: LedgerInput): Promise<LedgerView<StampsHistoryRow>> {
    // stamp has no organizationId; scope through the customer's cards.
    const cards = await this.db
      .select({ id: loyaltyCard.id })
      .from(loyaltyCard)
      .where(and(eq(loyaltyCard.organizationId, orgId), eq(loyaltyCard.customerId, input.customerId)));
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length === 0) return { items: [], nextCursor: null };
    const conds = [inArray(stamp.cardId, cardIds)];
    this.pushCursor(conds, stamp.createdAt, input.cursor);
    const rows = await this.db
      .select({
        id: stamp.id,
        amount: stamp.amount,
        note: stamp.note,
        purchaseId: stamp.purchaseId,
        createdAt: stamp.createdAt,
      })
      .from(stamp)
      .where(and(...conds))
      .orderBy(desc(stamp.createdAt))
      .limit(input.limit + 1);
    return this.paginate(rows, input.limit, (r) => ({
      id: r.id,
      amount: r.amount,
      note: r.note,
      hasPurchase: r.purchaseId != null,
      createdAt: r.createdAt,
    }));
  }

  async redemptionsHistory(orgId: string, input: LedgerInput): Promise<LedgerView<RedemptionHistoryRow>> {
    const conds = [
      eq(redemption.organizationId, orgId),
      eq(redemption.customerId, input.customerId),
    ];
    this.pushCursor(conds, redemption.createdAt, input.cursor);
    const rows = await this.db
      .select({
        id: redemption.id,
        rewardName: reward.name,
        currency: redemption.currency,
        stampsSpent: redemption.stampsSpent,
        pointsSpent: redemption.pointsSpent,
        createdAt: redemption.createdAt,
      })
      .from(redemption)
      .leftJoin(reward, eq(reward.id, redemption.rewardId))
      .where(and(...conds))
      .orderBy(desc(redemption.createdAt))
      .limit(input.limit + 1);
    return this.paginate(rows, input.limit, (r) => ({
      id: r.id,
      rewardName: r.rewardName ?? null,
      currency: r.currency,
      stampsSpent: r.stampsSpent,
      pointsSpent: r.pointsSpent,
      createdAt: r.createdAt,
    }));
  }

  // ── timeline (activity tab) ──────────────────────────────────────────────────
  /** Omnichannel merge: purchases, redemptions, points, stamps, messages
   *  (notification + campaign send), and admin audit events — cursor-paginated
   *  on `createdAt`. Each source over-fetches `limit`; we merge, sort, slice. */
  async timeline(orgId: string, input: TimelineInput): Promise<TimelineView> {
    const cursor = input.cursor ? new Date(input.cursor) : null;
    const lim = input.limit;
    const before = (col: Column): SQL[] =>
      cursor && !Number.isNaN(cursor.getTime()) ? [lt(col, cursor)] : [];

    const [purchases, redemptions, points, stamps, notifs, sends, audits] = await Promise.all([
      this.db
        .select({ id: purchase.id, at: purchase.createdAt, cents: purchase.priceCents, voidedAt: purchase.voidedAt })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), eq(purchase.customerId, input.customerId), ...before(purchase.createdAt)))
        .orderBy(desc(purchase.createdAt))
        .limit(lim + 1),
      this.db
        .select({ id: redemption.id, at: redemption.createdAt, rewardId: redemption.rewardId, name: reward.name })
        .from(redemption)
        .leftJoin(reward, eq(reward.id, redemption.rewardId))
        .where(and(eq(redemption.organizationId, orgId), eq(redemption.customerId, input.customerId), ...before(redemption.createdAt)))
        .orderBy(desc(redemption.createdAt))
        .limit(lim + 1),
      this.db
        .select({ id: pointsTransaction.id, at: pointsTransaction.createdAt, type: pointsTransaction.type, points: pointsTransaction.points, reason: pointsTransaction.reason })
        .from(pointsTransaction)
        .where(and(eq(pointsTransaction.organizationId, orgId), eq(pointsTransaction.customerId, input.customerId), ...before(pointsTransaction.createdAt)))
        .orderBy(desc(pointsTransaction.createdAt))
        .limit(lim + 1),
      this.stampTimeline(orgId, input.customerId, cursor, lim),
      this.db
        .select({ id: notification.id, at: notification.createdAt, type: notification.type, title: notification.title, body: notification.body })
        .from(notification)
        .where(and(eq(notification.organizationId, orgId), eq(notification.customerId, input.customerId), ...before(notification.createdAt)))
        .orderBy(desc(notification.createdAt))
        .limit(lim + 1),
      this.db
        .select({ id: campaignSend.id, at: campaignSend.sentAt, channel: campaignSend.channel, campaignId: campaignSend.campaignId })
        .from(campaignSend)
        .where(and(eq(campaignSend.organizationId, orgId), eq(campaignSend.customerId, input.customerId), isNotNull(campaignSend.sentAt), ...before(campaignSend.sentAt)))
        .orderBy(desc(campaignSend.sentAt))
        .limit(lim + 1),
      this.db
        .select({ id: auditLog.id, at: auditLog.createdAt, type: auditLog.type, metadata: auditLog.metadata })
        .from(auditLog)
        .where(and(eq(auditLog.organizationId, orgId), eq(auditLog.targetUserId, input.customerId), ...before(auditLog.createdAt)))
        .orderBy(desc(auditLog.createdAt))
        .limit(lim + 1),
    ]);

    const events: TimelineEvent[] = [];
    for (const p of purchases) {
      events.push({ id: `p_${p.id}`, kind: "purchase", at: p.at, title: "Compra", detail: null, amount: p.cents, refId: p.id, negative: p.voidedAt != null });
    }
    for (const r of redemptions) {
      events.push({ id: `r_${r.id}`, kind: "redeem", at: r.at, title: r.name ?? "Reward canjeado", detail: null, amount: null, refId: r.rewardId, negative: false });
    }
    for (const t of points) {
      const signed = t.points > 0 ? `+${t.points}` : `${t.points}`;
      events.push({ id: `pt_${t.id}`, kind: "points", at: t.at, title: `${signed} puntos`, detail: cleanReason(t.reason), amount: t.points, refId: null, negative: t.type === "adjust" && t.points < 0 });
    }
    for (const s of stamps) {
      const signed = s.amount > 0 ? `+${s.amount}` : `${s.amount}`;
      events.push({ id: `st_${s.id}`, kind: "stamp", at: s.at, title: `${signed} sello${Math.abs(s.amount) === 1 ? "" : "s"}`, detail: s.note, amount: s.amount, refId: null, negative: s.amount < 0 });
    }
    for (const n of notifs) {
      const isTier = n.type === "tier-up" || n.type === "tier-down";
      events.push({ id: `n_${n.id}`, kind: isTier ? "tier" : "message", at: n.at, title: n.title, detail: n.body.slice(0, 120), amount: null, refId: null, negative: n.type === "tier-down" });
    }
    for (const cs of sends) {
      if (!cs.at) continue;
      events.push({ id: `cs_${cs.id}`, kind: "message", at: cs.at, title: "Campaña enviada", detail: cs.channel, amount: null, refId: cs.campaignId, negative: false });
    }
    for (const a of audits) {
      events.push({ id: `a_${a.id}`, kind: "admin", at: a.at, title: auditTitle(a.type), detail: auditDetail(a.metadata), amount: null, refId: null, negative: a.type === "customer_ban" });
    }

    events.sort((x, y) => y.at.getTime() - x.at.getTime());
    const hasMore = events.length > lim;
    const page = events.slice(0, lim);
    return { items: page, nextCursor: hasMore ? (page[page.length - 1]?.at.toISOString() ?? null) : null };
  }

  private async stampTimeline(
    orgId: string,
    customerId: string,
    cursor: Date | null,
    lim: number,
  ): Promise<{ id: string; at: Date; amount: number; note: string | null }[]> {
    const cards = await this.db
      .select({ id: loyaltyCard.id })
      .from(loyaltyCard)
      .where(and(eq(loyaltyCard.organizationId, orgId), eq(loyaltyCard.customerId, customerId)));
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length === 0) return [];
    const conds = [inArray(stamp.cardId, cardIds)];
    if (cursor && !Number.isNaN(cursor.getTime())) conds.push(lt(stamp.createdAt, cursor));
    return this.db
      .select({ id: stamp.id, at: stamp.createdAt, amount: stamp.amount, note: stamp.note })
      .from(stamp)
      .where(and(...conds))
      .orderBy(desc(stamp.createdAt))
      .limit(lim + 1);
  }

  // ── writes ───────────────────────────────────────────────────────────────────
  /** Confirm a customer belongs to the org; returns id or null. */
  async exists(orgId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.organizationId, orgId), eq(customer.id, id)))
      .limit(1);
    return rows.length > 0;
  }

  async updateFields(
    orgId: string,
    id: string,
    patch: {
      name?: string | null;
      email?: string | null;
      nickname?: string | null;
      birthday?: Date | null;
    },
  ): Promise<void> {
    await this.db
      .update(customer)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(customer.organizationId, orgId), eq(customer.id, id)));
  }

  /** Phone is the login identifier — update the customer row AND the Better
   *  Auth user row (customer.id === user.id) in one tx. */
  async changePhone(orgId: string, id: string, newPhone: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(customer)
        .set({ phone: newPhone, updatedAt: new Date() })
        .where(and(eq(customer.organizationId, orgId), eq(customer.id, id)));
      await tx.update(user).set({ phoneNumber: newPhone }).where(eq(user.id, id));
    });
  }

  // ── availability ─────────────────────────────────────────────────────────────
  async checkAvailability(orgId: string, input: CheckAvailabilityInput): Promise<boolean> {
    const col =
      input.field === "phone" ? customer.phone : input.field === "email" ? customer.email : customer.nickname;
    const value = input.field === "nickname" ? input.value.toLowerCase() : input.value;
    const conds = [eq(customer.organizationId, orgId), eq(col, value)];
    if (input.excludeId) conds.push(ne(customer.id, input.excludeId));
    const rows = await this.db.select({ id: customer.id }).from(customer).where(and(...conds)).limit(1);
    return rows.length === 0; // true = available
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private listWhere(orgId: string, input: CustomersListInput): SQL | undefined {
    const conds: SQL[] = [eq(customer.organizationId, orgId)];
    if (input.q) {
      const t = `%${input.q}%`;
      conds.push(
        or(
          like(customer.name, t),
          like(customer.phone, t),
          like(customer.email, t),
          like(customer.nickname, t),
        )!,
      );
    }
    if (input.tiers?.length) conds.push(inArray(pointsAccount.currentTierKey, input.tiers));
    if (input.joinedFrom) conds.push(gte(customer.createdAt, input.joinedFrom));
    if (input.joinedTo) conds.push(lte(customer.createdAt, input.joinedTo));
    return and(...conds);
  }

  private listHaving(input: CustomersListInput, now: Date): SQL | undefined {
    const conds: SQL[] = [];
    const ltv = sql`coalesce(sum(${purchase.priceCents}), 0)`;
    if (input.spendMin != null) conds.push(sql`${ltv} >= ${input.spendMin}`);
    if (input.spendMax != null) conds.push(sql`${ltv} <= ${input.spendMax}`);
    if (input.status?.length) {
      const cutoff = toUnixSec(new Date(now.getTime() - 30 * DAY));
      const banned = sql`${user.banned} = 1`;
      const lastV = sql`max(${purchase.createdAt})`;
      const src: SQL[] = [];
      for (const s of input.status) {
        if (s === "banned") src.push(banned);
        else if (s === "active") src.push(sql`(${user.banned} is not 1 and ${lastV} >= ${cutoff})`);
        else src.push(sql`(${user.banned} is not 1 and (${lastV} < ${cutoff} or ${lastV} is null))`);
      }
      if (src.length) conds.push(or(...src)!);
    }
    return conds.length ? and(...conds) : undefined;
  }

  private listOrderBy(
    sort: CustomersListInput["sort"],
    aggs: { visits: SQL; ltv: SQL; lastVisit: SQL },
  ): SQL[] {
    const cols: Record<string, SQLWrapper> = {
      name: SORTABLE.name,
      createdAt: SORTABLE.createdAt,
      visits: aggs.visits,
      ltv: aggs.ltv,
      lastVisit: aggs.lastVisit,
    };
    return buildOrderBy(sort, cols, [desc(customer.createdAt)]);
  }

  private pushCursor(conds: SQL[], col: Column, cursor?: string): void {
    if (!cursor) return;
    const c = new Date(cursor);
    if (!Number.isNaN(c.getTime())) conds.push(lt(col, c));
  }

  private paginate<TRow extends { createdAt: Date }, TOut>(
    rows: TRow[],
    limit: number,
    map: (r: TRow) => TOut,
  ): LedgerView<TOut> {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(map),
      nextCursor: hasMore ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null,
    };
  }
}

/** Non-voided purchase scope for one customer. */
function scope(orgId: string, customerId: string): SQL {
  return and(
    eq(purchase.organizationId, orgId),
    eq(purchase.customerId, customerId),
    isNull(purchase.voidedAt),
  )!;
}

/** Strip internal prefixes from a ledger reason for display. */
function cleanReason(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === "purchase") return null;
  if (reason.startsWith("reward:")) return "Canje de reward";
  return reason.replace(/^void(-refund)?:\s*/, "Anulación: ");
}

const AUDIT_TITLES: Record<string, string> = {
  customer_ban: "Cliente baneado",
  customer_unban: "Cliente reactivado",
  customer_points_adjust: "Puntos ajustados",
  customer_stamps_adjust: "Sellos ajustados",
  customer_update: "Perfil actualizado",
  customer_create: "Cliente creado",
  impersonation_start: "Inicio de impersonación",
  impersonation_stop: "Fin de impersonación",
};
function auditTitle(type: string): string {
  return AUDIT_TITLES[type] ?? type;
}
function auditDetail(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  if (typeof metadata.reason === "string") return metadata.reason;
  return null;
}
