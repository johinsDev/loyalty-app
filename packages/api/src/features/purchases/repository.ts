import type { db as Db } from "@loyalty/db";
import {
  modifierOption,
  pointsTransaction,
  product,
  productImage,
  productOptionValue,
  productVariantValue,
  promo,
  purchase,
  purchaseItem,
  redemption,
  reward,
  stamp,
  user,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";

import type {
  PurchaseDetail,
  PurchaseDetailItem,
  PurchaseListItem,
  PurchaseListView,
  UsualItem,
} from "./schemas";

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
        p.appliedPromoId
          ? this.detailPromo(p.appliedPromoId, p.discountCents)
          : Promise.resolve(null),
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
