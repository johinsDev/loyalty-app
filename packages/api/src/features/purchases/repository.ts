import type { db as Db } from "@loyalty/db";
import {
  customer,
  loyaltyCard,
  modifierOption,
  pointsAccount,
  pointsTransaction,
  product,
  productImage,
  productOptionValue,
  productVariantValue,
  promo,
  promoRedemption,
  purchase,
  purchaseItem,
  redemption,
  reward,
  rewardAvailability,
  stamp,
  store,
  user,
} from "@loyalty/db/schema";
import {
  and,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { buildOrderBy, type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type {
  PurchaseAdminCustomer,
  PurchaseAdminDetail,
  PurchaseAdminListItem,
  PurchaseDetail,
  PurchaseDetailItem,
  PurchaseListItem,
  PurchaseListView,
  PurchasesAdminListInput,
  PurchasesKpis,
  PurchaseTimelineEvent,
  UsualItem,
} from "./schemas";

/** Columns the admin table may sort by (id → Drizzle column). */
const ADMIN_SORTABLE = {
  createdAt: purchase.createdAt,
  total: purchase.priceCents,
  discount: purchase.discountCents,
};

interface ListOpts {
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

/**
 * Drizzle access for the customer's purchase history. Reads are org+customer
 * scoped (ownership enforced in the WHERE). Per-page aggregates (items, stamps,
 * points, promo/reward presence) are resolved in batched `IN(...)` queries —
 * never N+1 — mirroring `points/repository.ts transactions`. Only layer that
 * touches the db.
 */
export class PurchasesRepository {
  constructor(private readonly db: typeof Db) {}

  /** Keyset-paginated history on `purchase.createdAt desc`, over-fetch +1. */
  async myPurchases(
    orgId: string,
    customerId: string,
    opts: ListOpts,
  ): Promise<PurchaseListView> {
    const conds = [
      eq(purchase.organizationId, orgId),
      eq(purchase.customerId, customerId),
    ];
    if (opts.from) conds.push(gte(purchase.createdAt, opts.from));
    if (opts.to) conds.push(lte(purchase.createdAt, opts.to));
    if (opts.cursor) {
      const c = new Date(opts.cursor);
      if (!Number.isNaN(c.getTime())) conds.push(lt(purchase.createdAt, c));
    }

    const rows = await this.db
      .select({
        id: purchase.id,
        createdAt: purchase.createdAt,
        priceCents: purchase.priceCents,
        subtotalCents: purchase.subtotalCents,
        discountCents: purchase.discountCents,
        currency: purchase.currency,
        appliedPromoId: purchase.appliedPromoId,
      })
      .from(purchase)
      .where(and(...conds))
      .orderBy(desc(purchase.createdAt))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;
    const ids = page.map((r) => r.id);

    const [summaries, stampsByPurchase, pointsByPurchase, rewardIds] =
      await Promise.all([
        this.itemSummaries(ids),
        this.stampsByPurchase(ids),
        this.pointsByPurchase(orgId, customerId, ids),
        this.purchasesWithReward(ids),
      ]);

    const items: PurchaseListItem[] = page.map((r) => {
      const summary = summaries.get(r.id);
      return {
        id: r.id,
        createdAt: r.createdAt,
        totalCents: r.priceCents,
        subtotalCents: r.subtotalCents ?? null,
        discountCents: r.discountCents,
        currency: r.currency,
        itemSummary: summary?.label ?? null,
        itemCount: summary?.count ?? 0,
        stampsEarned: stampsByPurchase.get(r.id) ?? 0,
        pointsEarned: pointsByPurchase.get(r.id) ?? 0,
        hasPromo: r.appliedPromoId != null,
        hasReward: rewardIds.has(r.id),
      };
    });

    const nextCursor = hasMore
      ? (page[page.length - 1]?.createdAt.toISOString() ?? null)
      : null;
    return { items, nextCursor };
  }

  async recentPurchases(
    orgId: string,
    customerId: string,
    limit: number,
  ): Promise<PurchaseListItem[]> {
    const { items } = await this.myPurchases(orgId, customerId, { limit });
    return items;
  }

  /** Full composition for the detail screen. NOT_FOUND-able rows return null so
   *  the service can throw the typed error. */
  async purchaseDetail(
    orgId: string,
    customerId: string,
    id: string,
  ): Promise<PurchaseDetail | null> {
    const rows = await this.db
      .select({
        id: purchase.id,
        createdAt: purchase.createdAt,
        priceCents: purchase.priceCents,
        subtotalCents: purchase.subtotalCents,
        discountCents: purchase.discountCents,
        currency: purchase.currency,
        appliedPromoId: purchase.appliedPromoId,
        addedByUserId: purchase.addedByUserId,
      })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
          eq(purchase.id, id),
        ),
      )
      .limit(1);
    const p = rows[0];
    if (!p) return null;

    const [cashierName, items, promoBlock, rewardBlock, stamps, points] =
      await Promise.all([
        this.cashierName(p.addedByUserId),
        this.detailItems(id),
        this.promoBlock(p.appliedPromoId, id, p.discountCents),
        this.detailReward(id),
        this.stampsByPurchase([id]).then((m) => m.get(id) ?? 0),
        this.pointsByPurchase(orgId, customerId, [id]).then(
          (m) => m.get(id) ?? 0,
        ),
      ]);

    return {
      id: p.id,
      createdAt: p.createdAt,
      cashierName,
      storeName: null,
      items,
      promo: promoBlock,
      reward: rewardBlock,
      subtotalCents: p.subtotalCents ?? null,
      discountCents: p.discountCents,
      totalCents: p.priceCents,
      currency: p.currency,
      stampsEarned: stamps,
      pointsEarned: points,
    };
  }

  /** Top products by appearance count across the customer's purchases. */
  async usuals(
    orgId: string,
    customerId: string,
    limit: number,
  ): Promise<UsualItem[]> {
    const rows = await this.db
      .select({
        productId: purchaseItem.productId,
        orders: sql<number>`count(*)`,
      })
      .from(purchaseItem)
      .innerJoin(purchase, eq(purchaseItem.purchaseId, purchase.id))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
        ),
      )
      .groupBy(purchaseItem.productId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    const productIds = rows.map((r) => r.productId);
    if (productIds.length === 0) return [];

    const [products, images] = await Promise.all([
      this.db
        .select({ id: product.id, name: product.name, slug: product.slug })
        .from(product)
        .where(inArray(product.id, productIds)),
      this.firstProductImages(productIds),
    ]);
    const byId = new Map(products.map((pr) => [pr.id, pr]));

    return rows
      .map((r) => {
        const pr = byId.get(r.productId);
        if (!pr) return null;
        return {
          productId: r.productId,
          name: pr.name,
          slug: pr.slug,
          imageUrl: images.get(r.productId) ?? null,
          orders: r.orders,
        };
      })
      .filter((x): x is UsualItem => x !== null);
  }

  // ---- admin (org-scoped) ---------------------------------------------------

  /** Paginated/filtered/sorted list for the admin data-table (org-scoped). */
  async adminList(
    orgId: string,
    input: PurchasesAdminListInput,
  ): Promise<ListResult<PurchaseAdminListItem>> {
    const where = this.adminWhere(orgId, input);
    const orderBy = buildOrderBy(input.sort, ADMIN_SORTABLE, [desc(purchase.createdAt)]);
    const rows = await this.rawListRows(where)
      .orderBy(...orderBy)
      .limit(input.perPage)
      .offset(pageOffset(input.page, input.perPage));
    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(purchase)
      .innerJoin(customer, eq(purchase.customerId, customer.id))
      .where(where);
    const total = totalRows[0]?.value ?? 0;
    const items = await this.hydrateListRows(orgId, rows);
    return { rows: items, total, pageCount: pageCountOf(total, input.perPage) };
  }

  /** Lean rows for the given ids (CSV export of a selection). */
  async listByIds(orgId: string, ids: string[]): Promise<PurchaseAdminListItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.rawListRows(
      and(eq(purchase.organizationId, orgId), inArray(purchase.id, ids)),
    );
    return this.hydrateListRows(orgId, rows);
  }

  /** Aggregate KPIs honoring the same filters as the list. */
  async adminKpis(orgId: string, input: PurchasesAdminListInput): Promise<PurchasesKpis> {
    const where = this.adminWhere(orgId, input);
    const rows = await this.db
      .select({
        count: sql<number>`count(*)`,
        net: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
        promo: sql<number>`coalesce(sum(case when ${purchase.appliedPromoId} is not null then 1 else 0 end), 0)`,
      })
      .from(purchase)
      .innerJoin(customer, eq(purchase.customerId, customer.id))
      // KPIs count active sales only — voided purchases are excluded from revenue.
      .where(and(where, isNull(purchase.voidedAt)));
    const r = rows[0];
    const count = r?.count ?? 0;
    const net = r?.net ?? 0;
    const promo = r?.promo ?? 0;
    return {
      count,
      netRevenueCents: net,
      avgTicketCents: count > 0 ? Math.round(net / count) : 0,
      promoRate: count > 0 ? promo / count : 0,
    };
  }

  /** Full "radiografía" for the admin detail (org-scoped, any customer). */
  async adminGet(orgId: string, id: string): Promise<PurchaseAdminDetail | null> {
    const rows = await this.db
      .select({
        id: purchase.id,
        createdAt: purchase.createdAt,
        priceCents: purchase.priceCents,
        subtotalCents: purchase.subtotalCents,
        discountCents: purchase.discountCents,
        currency: purchase.currency,
        appliedPromoId: purchase.appliedPromoId,
        addedByUserId: purchase.addedByUserId,
        storeId: purchase.storeId,
        entrySource: purchase.entrySource,
        metadata: purchase.metadata,
        idempotencyKey: purchase.idempotencyKey,
        customerId: purchase.customerId,
        voidedAt: purchase.voidedAt,
        voidReason: purchase.voidReason,
        voidedByUserId: purchase.voidedByUserId,
      })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), eq(purchase.id, id)))
      .limit(1);
    const p = rows[0];
    if (!p) return null;

    const [
      cashierName,
      items,
      promoBlock,
      rewardBlock,
      stamps,
      points,
      storeName,
      customerBlock,
      adjustments,
    ] = await Promise.all([
      this.cashierName(p.addedByUserId),
      this.detailItems(id),
      this.promoBlock(p.appliedPromoId, id, p.discountCents),
      this.detailReward(id),
      this.stampsByPurchase([id]).then((m) => m.get(id) ?? 0),
      this.pointsByPurchaseOrg(orgId, [id]).then((m) => m.get(id) ?? 0),
      p.storeId ? this.storeName(p.storeId) : Promise.resolve(null),
      this.customerBlock(orgId, p.customerId),
      this.adjustEvents(id),
    ]);

    const voidedByName = p.voidedByUserId ? await this.cashierName(p.voidedByUserId) : null;
    const voidMeta = (p.metadata as Record<string, unknown> | null)?.void as
      | { stamps?: number; points?: number }
      | undefined;
    const reversal = p.voidedAt
      ? { stamps: voidMeta?.stamps ?? stamps, points: voidMeta?.points ?? points }
      : null;

    return {
      id: p.id,
      createdAt: p.createdAt,
      cashierName,
      storeName,
      items,
      promo: promoBlock,
      reward: rewardBlock,
      subtotalCents: p.subtotalCents ?? null,
      discountCents: p.discountCents,
      totalCents: p.priceCents,
      currency: p.currency,
      stampsEarned: stamps,
      pointsEarned: points,
      customer: customerBlock,
      storeId: p.storeId ?? null,
      entrySource: p.entrySource ?? null,
      attributionCampaignId:
        p.metadata && typeof (p.metadata as Record<string, unknown>).campaignId === "string"
          ? ((p.metadata as Record<string, unknown>).campaignId as string)
          : null,
      idempotencyKey: p.idempotencyKey,
      voidedAt: p.voidedAt ?? null,
      voidReason: p.voidReason ?? null,
      voidedByName,
      reversal,
      timeline: this.buildTimeline({
        createdAt: p.createdAt,
        cashierName,
        // For a voided sale the stamp rows are gone, so show the original grant
        // (from the reversal record) — mirroring how points stays visible.
        stamps: reversal ? reversal.stamps : stamps,
        points,
        reward: rewardBlock,
        adjustments,
        voided: p.voidedAt
          ? { at: p.voidedAt, reason: p.voidReason, actorName: voidedByName }
          : null,
      }),
    };
  }

  /** Void a purchase and reverse ALL of its loyalty effects in one transaction:
   *  remove granted stamps, reverse earned points, refund a redeemed reward
   *  (stamps/points back + re-arm availability), free the promo usage, and stamp
   *  `voidedAt`/reason/actor. Returns the customer (for a tier recompute after).
   *  Idempotent-guarded: re-voiding returns "already_voided". */
  async voidPurchase(
    orgId: string,
    purchaseId: string,
    reason: string,
    userId: string,
  ): Promise<
    | { customerId: string; reversal: { stamps: number; points: number } }
    | "not_found"
    | "already_voided"
  > {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          customerId: purchase.customerId,
          walletId: purchase.walletId,
          storeId: purchase.storeId,
          voidedAt: purchase.voidedAt,
          metadata: purchase.metadata,
        })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), eq(purchase.id, purchaseId)))
        .limit(1);
      const p = rows[0];
      if (!p) return "not_found";
      if (p.voidedAt) return "already_voided";

      // 1. Reverse granted stamps (delete the rows + decrement the card).
      const stampRows = await tx
        .select({ amount: stamp.amount })
        .from(stamp)
        .where(eq(stamp.purchaseId, purchaseId));
      const granted = stampRows.reduce((s, r) => s + r.amount, 0);
      if (granted > 0) {
        await tx
          .update(loyaltyCard)
          .set({
            currentStamps: sql`max(0, ${loyaltyCard.currentStamps} - ${granted})`,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyCard.id, p.walletId));
        await tx.delete(stamp).where(eq(stamp.purchaseId, purchaseId));
      }

      // 2. Reverse earned points with a signed `adjust` (balance nets to 0; the
      //    earn row stays but the voided purchase no longer counts toward tier).
      const earnRows = await tx
        .select({ points: pointsTransaction.points })
        .from(pointsTransaction)
        .where(
          and(eq(pointsTransaction.purchaseId, purchaseId), eq(pointsTransaction.type, "earn")),
        )
        .limit(1);
      const earned = earnRows[0]?.points ?? 0;
      if (earned > 0) {
        await tx.insert(pointsTransaction).values({
          customerId: p.customerId,
          organizationId: orgId,
          type: "adjust",
          points: -earned,
          reason: `void: ${reason}`,
          purchaseId,
          addedByUserId: userId,
          storeId: p.storeId,
        });
      }

      // 3. Reverse an inline reward redemption (refund the spent currency +
      //    re-arm availability), then drop the redemption row.
      const redRows = await tx
        .select({
          id: redemption.id,
          rewardId: redemption.rewardId,
          cardId: redemption.cardId,
          stampsSpent: redemption.stampsSpent,
          pointsSpent: redemption.pointsSpent,
        })
        .from(redemption)
        .where(eq(redemption.purchaseId, purchaseId));
      // oxlint-disable no-await-in-loop -- sequential writes on one tx handle
      for (const r of redRows) {
        if (r.stampsSpent > 0 && r.cardId) {
          await tx
            .update(loyaltyCard)
            .set({
              currentStamps: sql`${loyaltyCard.currentStamps} + ${r.stampsSpent}`,
              updatedAt: new Date(),
            })
            .where(eq(loyaltyCard.id, r.cardId));
        }
        if (r.pointsSpent > 0) {
          await tx.insert(pointsTransaction).values({
            customerId: p.customerId,
            organizationId: orgId,
            type: "adjust",
            points: r.pointsSpent,
            reason: `void-refund: ${reason}`,
            purchaseId,
            addedByUserId: userId,
            storeId: p.storeId,
          });
        }
        await tx
          .insert(rewardAvailability)
          .values({
            customerId: p.customerId,
            organizationId: orgId,
            rewardId: r.rewardId,
            readyAt: new Date(),
            lastStage: "immediate",
          })
          .onConflictDoNothing();
        await tx.delete(redemption).where(eq(redemption.id, r.id));
      }
      // oxlint-enable no-await-in-loop

      // 4. Free the promo usage (the sale no longer counts against its limits).
      await tx.delete(promoRedemption).where(eq(promoRedemption.purchaseId, purchaseId));

      // 5. Mark voided, recording what was reversed (so the detail can show the
      //    original loyalty struck as "reverted" even though the rows are gone).
      const meta = (p.metadata as Record<string, unknown> | null) ?? {};
      await tx
        .update(purchase)
        .set({
          voidedAt: new Date(),
          voidReason: reason,
          voidedByUserId: userId,
          metadata: { ...meta, void: { stamps: granted, points: earned } },
        })
        .where(eq(purchase.id, purchaseId));

      return { customerId: p.customerId, reversal: { stamps: granted, points: earned } };
    });
  }

  /** The list WHERE shared by `adminList`, `listByIds` (via caller) and `adminKpis`. */
  private adminWhere(orgId: string, input: PurchasesAdminListInput): SQL | undefined {
    const conds: SQL[] = [eq(purchase.organizationId, orgId)];
    if (input.q) {
      const term = `%${input.q}%`;
      conds.push(or(like(customer.name, term), like(customer.phone, term))!);
    }
    if (input.storeIds?.length) conds.push(inArray(purchase.storeId, input.storeIds));
    if (input.cashierIds?.length) conds.push(inArray(purchase.addedByUserId, input.cashierIds));
    if (input.customerId) conds.push(eq(purchase.customerId, input.customerId));
    if (input.dateFrom) conds.push(gte(purchase.createdAt, input.dateFrom));
    if (input.dateTo) conds.push(lte(purchase.createdAt, input.dateTo));
    if (input.amountMin != null) conds.push(gte(purchase.priceCents, input.amountMin));
    if (input.amountMax != null) conds.push(lte(purchase.priceCents, input.amountMax));

    const rewardExists = exists(
      this.db
        .select({ n: sql`1` })
        .from(redemption)
        .where(eq(redemption.purchaseId, purchase.id)),
    );
    if (input.effectiveness?.length) {
      const eff: SQL[] = [];
      for (const e of input.effectiveness) {
        if (e === "promo") eff.push(isNotNull(purchase.appliedPromoId));
        else if (e === "reward") eff.push(rewardExists);
        else eff.push(and(isNull(purchase.appliedPromoId), not(rewardExists))!);
      }
      if (eff.length) conds.push(or(...eff)!);
    }
    if (input.redemptionCurrency?.length) {
      conds.push(
        exists(
          this.db
            .select({ n: sql`1` })
            .from(redemption)
            .where(
              and(
                eq(redemption.purchaseId, purchase.id),
                inArray(redemption.currency, input.redemptionCurrency),
              ),
            ),
        ),
      );
    }
    if (input.entrySource?.length) {
      const src: SQL[] = [];
      for (const e of input.entrySource) {
        // Legacy rows have no attribution → treat null as "organic".
        if (e === "organic") {
          src.push(or(eq(purchase.entrySource, "organic"), isNull(purchase.entrySource))!);
        } else {
          src.push(eq(purchase.entrySource, e));
        }
      }
      if (src.length) conds.push(or(...src)!);
    }
    return and(...conds);
  }

  /** The list row select with customer/store/cashier joins (no order/paging). */
  private rawListRows(where: SQL | undefined) {
    return this.db
      .select({
        id: purchase.id,
        createdAt: purchase.createdAt,
        priceCents: purchase.priceCents,
        discountCents: purchase.discountCents,
        currency: purchase.currency,
        appliedPromoId: purchase.appliedPromoId,
        customerId: purchase.customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        storeName: store.name,
        cashierName: user.name,
        voidedAt: purchase.voidedAt,
      })
      .from(purchase)
      .innerJoin(customer, eq(purchase.customerId, customer.id))
      .leftJoin(store, eq(purchase.storeId, store.id))
      .leftJoin(user, eq(purchase.addedByUserId, user.id))
      .where(where);
  }

  /** Attach per-purchase aggregates (items/stamps/points/reward) to raw rows. */
  private async hydrateListRows(
    orgId: string,
    rows: Awaited<ReturnType<PurchasesRepository["rawListRows"]>>,
  ): Promise<PurchaseAdminListItem[]> {
    const ids = rows.map((r) => r.id);
    const [summaries, stampsByP, pointsByP, rewardIds] = await Promise.all([
      this.itemSummaries(ids),
      this.stampsByPurchase(ids),
      this.pointsByPurchaseOrg(orgId, ids),
      this.purchasesWithReward(ids),
    ]);
    return rows.map((r) => {
      const summary = summaries.get(r.id);
      return {
        id: r.id,
        createdAt: r.createdAt,
        customerId: r.customerId,
        customerName: r.customerName ?? null,
        customerPhone: r.customerPhone,
        storeName: r.storeName ?? null,
        cashierName: r.cashierName ?? null,
        itemSummary: summary?.label ?? null,
        itemCount: summary?.count ?? 0,
        totalCents: r.priceCents,
        discountCents: r.discountCents,
        currency: r.currency,
        stampsEarned: stampsByP.get(r.id) ?? 0,
        pointsEarned: pointsByP.get(r.id) ?? 0,
        hasPromo: r.appliedPromoId != null,
        hasReward: rewardIds.has(r.id),
        voidedAt: r.voidedAt ?? null,
      };
    });
  }

  /** Earned points per purchase across the org (not customer-scoped). */
  private async pointsByPurchaseOrg(
    orgId: string,
    purchaseIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (purchaseIds.length === 0) return out;
    const rows = await this.db
      .select({
        purchaseId: pointsTransaction.purchaseId,
        points: pointsTransaction.points,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.type, "earn"),
          inArray(pointsTransaction.purchaseId, purchaseIds),
        ),
      );
    for (const r of rows) {
      if (r.purchaseId) out.set(r.purchaseId, r.points);
    }
    return out;
  }

  /** Promo block for a purchase detail. `purchase.discountCents` may bundle a
   *  reward's share too (promo + inline reward on one ticket) — so the promo's
   *  real discount comes from `promo_redemption`, falling back to the total. */
  private async promoBlock(
    appliedPromoId: string | null,
    purchaseId: string,
    totalDiscountCents: number,
  ): Promise<PurchaseDetail["promo"]> {
    if (!appliedPromoId) return null;
    const rows = await this.db
      .select({ d: promoRedemption.discountCents })
      .from(promoRedemption)
      .where(eq(promoRedemption.purchaseId, purchaseId))
      .limit(1);
    return this.detailPromo(appliedPromoId, rows[0]?.d ?? totalDiscountCents);
  }

  private async storeName(storeId: string): Promise<string | null> {
    const rows = await this.db
      .select({ name: store.name })
      .from(store)
      .where(eq(store.id, storeId))
      .limit(1);
    return rows[0]?.name ?? null;
  }

  private async customerBlock(
    orgId: string,
    customerId: string,
  ): Promise<PurchaseAdminCustomer> {
    const rows = await this.db
      .select({
        name: customer.name,
        phone: customer.phone,
        createdAt: customer.createdAt,
        tierKey: pointsAccount.currentTierKey,
      })
      .from(customer)
      .leftJoin(
        pointsAccount,
        and(
          eq(pointsAccount.customerId, customer.id),
          eq(pointsAccount.organizationId, orgId),
        ),
      )
      .where(eq(customer.id, customerId))
      .limit(1);
    const c = rows[0];
    return {
      id: customerId,
      name: c?.name ?? null,
      phone: c?.phone ?? "",
      tierKey: c?.tierKey ?? null,
      memberSince: c?.createdAt ?? new Date(0),
    };
  }

  /** Signed manual point adjustments tied to a purchase (with the actor). */
  private async adjustEvents(
    purchaseId: string,
  ): Promise<{ points: number; reason: string | null; createdAt: Date; actorName: string | null }[]> {
    const rows = await this.db
      .select({
        points: pointsTransaction.points,
        reason: pointsTransaction.reason,
        createdAt: pointsTransaction.createdAt,
        actor: user.name,
      })
      .from(pointsTransaction)
      .leftJoin(user, eq(pointsTransaction.addedByUserId, user.id))
      .where(
        and(eq(pointsTransaction.purchaseId, purchaseId), eq(pointsTransaction.type, "adjust")),
      )
      .orderBy(pointsTransaction.createdAt);
    return (
      rows
        // Void-reversal adjusts are surfaced as a single "void" event, not as
        // manual corrections — keep only genuine manual adjustments here.
        .filter((r) => !r.reason?.startsWith("void:") && !r.reason?.startsWith("void-refund:"))
        .map((r) => ({
          points: r.points,
          reason: r.reason,
          createdAt: r.createdAt,
          actorName: r.actor ?? null,
        }))
    );
  }

  /** A purchase's "audit" timeline, derived from existing rows (no new table).
   *  The sale/stamp/redeem/points events share the register `createdAt`; manual
   *  point adjustments carry their own (later) timestamp + reason + actor. */
  private buildTimeline(args: {
    createdAt: Date;
    cashierName: string | null;
    stamps: number;
    points: number;
    reward: PurchaseDetail["reward"];
    adjustments: { points: number; reason: string | null; createdAt: Date; actorName: string | null }[];
    voided: { at: Date; reason: string | null; actorName: string | null } | null;
  }): PurchaseTimelineEvent[] {
    const events: PurchaseTimelineEvent[] = [
      { kind: "sale", at: args.createdAt, actorName: args.cashierName, amount: null, rewardName: null, reason: null },
    ];
    if (args.stamps > 0) {
      events.push({
        kind: "stamp",
        at: args.createdAt,
        actorName: args.cashierName,
        amount: args.stamps,
        rewardName: null,
        reason: null,
      });
    }
    if (args.reward) {
      events.push({
        kind: "redeem",
        at: args.createdAt,
        actorName: args.cashierName,
        amount: null,
        rewardName: args.reward.name,
        reason: null,
      });
    }
    if (args.points > 0) {
      events.push({
        kind: "points",
        at: args.createdAt,
        actorName: null,
        amount: args.points,
        rewardName: null,
        reason: null,
      });
    }
    for (const a of args.adjustments) {
      events.push({
        kind: "adjust",
        at: a.createdAt,
        actorName: a.actorName,
        amount: a.points,
        rewardName: null,
        reason: a.reason,
      });
    }
    if (args.voided) {
      events.push({
        kind: "void",
        at: args.voided.at,
        actorName: args.voided.actorName,
        amount: null,
        rewardName: null,
        reason: args.voided.reason,
      });
    }
    return events;
  }

  // ---- batched resolvers ----------------------------------------------------

  /** Per-purchase: distinct item count + a "2× Name +N" summary (first item's
   *  product name; "+N" when there are more line items). */
  private async itemSummaries(
    purchaseIds: string[],
  ): Promise<Map<string, { label: string; count: number }>> {
    const out = new Map<string, { label: string; count: number }>();
    if (purchaseIds.length === 0) return out;

    const rows = await this.db
      .select({
        purchaseId: purchaseItem.purchaseId,
        productId: purchaseItem.productId,
        qty: purchaseItem.qty,
        name: product.name,
      })
      .from(purchaseItem)
      .leftJoin(product, eq(purchaseItem.productId, product.id))
      .where(inArray(purchaseItem.purchaseId, purchaseIds));

    // Group by purchase, preserving insertion order = the first line item shown.
    const grouped = new Map<
      string,
      { qty: number; name: string | null }[]
    >();
    for (const r of rows) {
      const list = grouped.get(r.purchaseId) ?? [];
      list.push({ qty: r.qty, name: r.name });
      grouped.set(r.purchaseId, list);
    }

    for (const [pid, list] of grouped) {
      const count = list.length;
      const first = list[0];
      const firstName = first?.name ?? "—";
      const firstQty = first?.qty ?? 1;
      const head = firstQty > 1 ? `${firstQty}× ${firstName}` : firstName;
      const label = count > 1 ? `${head} +${count - 1}` : head;
      out.set(pid, { label, count });
    }
    return out;
  }

  /** Sum of `stamp.amount` per purchase. */
  private async stampsByPurchase(
    purchaseIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (purchaseIds.length === 0) return out;
    const rows = await this.db
      .select({
        purchaseId: stamp.purchaseId,
        total: sql<number>`coalesce(sum(${stamp.amount}), 0)`,
      })
      .from(stamp)
      .where(inArray(stamp.purchaseId, purchaseIds))
      .groupBy(stamp.purchaseId);
    for (const r of rows) out.set(r.purchaseId, r.total);
    return out;
  }

  /** Earned points per purchase (the `earn` ledger row, one per purchase). */
  private async pointsByPurchase(
    orgId: string,
    customerId: string,
    purchaseIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (purchaseIds.length === 0) return out;
    const rows = await this.db
      .select({
        purchaseId: pointsTransaction.purchaseId,
        points: pointsTransaction.points,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
          eq(pointsTransaction.type, "earn"),
          inArray(pointsTransaction.purchaseId, purchaseIds),
        ),
      );
    for (const r of rows) {
      if (r.purchaseId) out.set(r.purchaseId, r.points);
    }
    return out;
  }

  /** The set of purchase ids that have an inline reward redemption. */
  private async purchasesWithReward(
    purchaseIds: string[],
  ): Promise<Set<string>> {
    const out = new Set<string>();
    if (purchaseIds.length === 0) return out;
    const rows = await this.db
      .selectDistinct({ purchaseId: redemption.purchaseId })
      .from(redemption)
      .where(inArray(redemption.purchaseId, purchaseIds));
    for (const r of rows) {
      if (r.purchaseId) out.add(r.purchaseId);
    }
    return out;
  }

  private async cashierName(userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0]?.name ?? null;
  }

  private async detailItems(
    purchaseId: string,
  ): Promise<PurchaseDetailItem[]> {
    const rows = await this.db
      .select({
        id: purchaseItem.id,
        productId: purchaseItem.productId,
        variantId: purchaseItem.variantId,
        modifierOptionIds: purchaseItem.modifierOptionIds,
        qty: purchaseItem.qty,
        unitAmountCents: purchaseItem.unitAmountCents,
        name: product.name,
        slug: product.slug,
      })
      .from(purchaseItem)
      .leftJoin(product, eq(purchaseItem.productId, product.id))
      .where(eq(purchaseItem.purchaseId, purchaseId));
    if (rows.length === 0) return [];

    // Batch-resolve variant labels (variant → its option-value labels) and
    // modifier-option labels.
    const variantIds = [
      ...new Set(
        rows.map((r) => r.variantId).filter((v): v is string => v != null),
      ),
    ];
    const modifierIds = [
      ...new Set(rows.flatMap((r) => r.modifierOptionIds ?? [])),
    ];

    const [variantLabels, modifierLabels] = await Promise.all([
      this.variantLabels(variantIds),
      this.modifierLabels(modifierIds),
    ]);

    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      name: r.name ?? null,
      slug: r.slug ?? null,
      variantLabel: r.variantId ? (variantLabels.get(r.variantId) ?? null) : null,
      modifierLabels: (r.modifierOptionIds ?? [])
        .map((mid) => modifierLabels.get(mid))
        .filter((l): l is string => l != null),
      qty: r.qty,
      unitAmountCents: r.unitAmountCents,
    }));
  }

  /** variantId → joined option-value labels (e.g. "Mediano / Caliente"). */
  private async variantLabels(
    variantIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (variantIds.length === 0) return out;
    const rows = await this.db
      .select({
        variantId: productVariantValue.variantId,
        label: productOptionValue.label,
      })
      .from(productVariantValue)
      .innerJoin(
        productOptionValue,
        eq(productVariantValue.optionValueId, productOptionValue.id),
      )
      .where(inArray(productVariantValue.variantId, variantIds));
    const grouped = new Map<string, string[]>();
    for (const r of rows) {
      const list = grouped.get(r.variantId) ?? [];
      list.push(r.label);
      grouped.set(r.variantId, list);
    }
    for (const [vid, labels] of grouped) out.set(vid, labels.join(" / "));
    return out;
  }

  private async modifierLabels(
    modifierIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (modifierIds.length === 0) return out;
    const rows = await this.db
      .select({ id: modifierOption.id, name: modifierOption.name })
      .from(modifierOption)
      .where(inArray(modifierOption.id, modifierIds));
    for (const r of rows) out.set(r.id, r.name);
    return out;
  }

  private async detailPromo(
    promoId: string,
    discountCents: number,
  ): Promise<PurchaseDetail["promo"]> {
    const rows = await this.db
      .select({
        id: promo.id,
        name: promo.name,
        slug: promo.slug,
        type: promo.type,
        rule: promo.rule,
      })
      .from(promo)
      .where(eq(promo.id, promoId))
      .limit(1);
    const pr = rows[0];
    if (!pr) {
      return {
        promoId,
        name: null,
        slug: null,
        discountCents,
        freeItemLabel: null,
      };
    }
    // A fully-free get-side (crossSell at 100%) reads as "free item" in history.
    let freeItemLabel: string | null = null;
    const rule = pr.rule;
    const freeRef =
      rule?.effect.kind === "percentOff" &&
      rule.effect.target === "get" &&
      rule.effect.percent === 100
        ? (rule.get?.requirements[0]?.refs[0] ?? null)
        : null;
    if (freeRef) freeItemLabel = await this.freeRefLabel(freeRef);
    return {
      promoId: pr.id,
      name: pr.name ?? null,
      slug: pr.slug ?? null,
      discountCents,
      freeItemLabel,
    };
  }

  private async freeRefLabel(freeRef: {
    kind: "product" | "variant" | "category" | "modifierOption";
    id: string;
  }): Promise<string | null> {
    if (freeRef.kind === "product") {
      const rows = await this.db
        .select({ name: product.name })
        .from(product)
        .where(eq(product.id, freeRef.id))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    if (freeRef.kind === "modifierOption") {
      const rows = await this.db
        .select({ name: modifierOption.name })
        .from(modifierOption)
        .where(eq(modifierOption.id, freeRef.id))
        .limit(1);
      return rows[0]?.name ?? null;
    }
    if (freeRef.kind === "category") return null;
    // variant → its option-value labels.
    const labels = await this.variantLabels([freeRef.id]);
    return labels.get(freeRef.id) ?? null;
  }

  private async detailReward(
    purchaseId: string,
  ): Promise<PurchaseDetail["reward"]> {
    const rows = await this.db
      .select({
        id: redemption.id,
        rewardId: redemption.rewardId,
        currency: redemption.currency,
        stampsSpent: redemption.stampsSpent,
        pointsSpent: redemption.pointsSpent,
        name: reward.name,
        imageUrl: reward.imageUrl,
      })
      .from(redemption)
      .leftJoin(reward, eq(redemption.rewardId, reward.id))
      .where(eq(redemption.purchaseId, purchaseId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      redemptionId: r.id,
      rewardId: r.rewardId,
      name: r.name ?? null,
      imageUrl: r.imageUrl ?? null,
      currency: r.currency as "stamps" | "points",
      stampsSpent: r.stampsSpent,
      pointsSpent: r.pointsSpent,
    };
  }

  /** productId → first image url (lowest sortOrder, product-level). */
  private async firstProductImages(
    productIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (productIds.length === 0) return out;
    const rows = await this.db
      .select({
        productId: productImage.productId,
        url: productImage.url,
        sortOrder: productImage.sortOrder,
      })
      .from(productImage)
      .where(inArray(productImage.productId, productIds))
      .orderBy(productImage.sortOrder);
    for (const r of rows) {
      if (!out.has(r.productId)) out.set(r.productId, r.url);
    }
    return out;
  }
}
