import type { db as Db } from "@loyalty/db";
import {
  category,
  ingredient,
  organizationSettings,
  product,
  productCategory,
  promo,
  purchase,
  purchaseItem,
  reward,
  variantIngredient,
} from "@loyalty/db/schema";
import { and, asc, eq, gte, inArray, isNull, like, or, sql } from "drizzle-orm";

import { slugify, slugSuffix } from "../_shared/slugify";
import {
  CATEGORY_PERIOD_DAYS,
  type CategoryCreateInput,
  type CategoryCreateResult,
  type CategoryMetrics,
  type CategoryReorderInput,
  type CategoryTreeInput,
  type CategoryTreeNode,
  type CategoryUpdateInput,
  type CategoryUsage,
} from "./schemas";

/**
 * Name of the leaf auto-created when a populated category gains its first child.
 * Deliberately not the parent's name — "Milk Tea › Milk Tea" reads like a bug.
 * The same word in es and en, so it needs no translation at write time; the
 * owner can rename it right away from the tree.
 */
const GENERAL_LEAF_NAME = "General";

/** Blank metrics for a node with no sales in the window. */
const ZERO: CategoryMetrics = {
  productCount: 0,
  revenueCents: 0,
  units: 0,
  marginPct: null,
  sharePct: 0,
};

const daysAgo = (from: Date, days: number) =>
  new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Aggregate {
  revenueCents: number;
  units: number;
  cogsCents: number;
}

/** The sibling leaf that will absorb a soon-to-be-parent's products. */
interface GeneralLeafPlan {
  id: string;
  slug: string;
  movedCount: number;
}

type Tx = Parameters<Parameters<(typeof Db)["transaction"]>[0]>[0];

/** Insert the General leaf and move the parent's products onto it. */
async function writeGeneralLeaf(
  tx: Tx,
  orgId: string,
  parentId: string,
  plan: GeneralLeafPlan,
): Promise<void> {
  await tx.insert(category).values({
    id: plan.id,
    organizationId: orgId,
    parentId,
    name: GENERAL_LEAF_NAME,
    slug: plan.slug,
    sortOrder: 0,
  });
  // Keeps `is_primary` with the row, so revenue attribution follows the products.
  await tx
    .update(productCategory)
    .set({ categoryId: plan.id })
    .where(eq(productCategory.categoryId, parentId));
}

/**
 * The org's category tree — two levels, soft-deleted, ordered.
 *
 * Invariants enforced here (the UI mirrors them, but this is the authority):
 * - **Max depth 2.** A node with children can never become a child itself.
 * - **Only leaves hold products.** Giving a populated category its first child
 *   moves that category's products into an auto-created "General" leaf, in the
 *   same transaction, so no product is ever stranded on a non-assignable node.
 * - **Archiving cascades down.** Children archived that way are flagged
 *   `archivedByParent` so restoring the parent revives exactly those and never
 *   a child that was archived on purpose.
 */
export class CategoriesRepository {
  constructor(private readonly db: typeof Db) {}

  // ---- reads ---------------------------------------------------------------

  /**
   * The whole tree with per-node figures. Categories are dozens, not thousands,
   * so every row is fetched and the hierarchy/rollup/search is resolved in
   * memory — that keeps it to 2-3 round trips instead of recursive SQL.
   */
  async tree(
    orgId: string,
    input: CategoryTreeInput,
    now = new Date(),
  ): Promise<CategoryTreeNode[]> {
    const rows = await this.db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        parentId: category.parentId,
        sortOrder: category.sortOrder,
        archivedAt: category.archivedAt,
        archivedByParent: category.archivedByParent,
      })
      .from(category)
      .where(eq(category.organizationId, orgId))
      .orderBy(asc(category.sortOrder), asc(category.name));

    if (rows.length === 0) return [];

    const [counts, sales] = await Promise.all([
      this.#productCounts(orgId),
      input.metrics
        ? this.#salesByPrimaryCategory(orgId, input, now)
        : Promise.resolve(new Map<string, Aggregate>()),
    ]);

    const childIds = new Set(rows.filter((r) => r.parentId).map((r) => r.parentId as string));
    const byId = new Map<string, CategoryTreeNode>(
      rows.map((r) => [
        r.id,
        {
          ...r,
          ...ZERO,
          isLeaf: !childIds.has(r.id),
          productCount: counts.get(r.id) ?? 0,
          revenueCents: sales.get(r.id)?.revenueCents ?? 0,
          units: sales.get(r.id)?.units ?? 0,
          marginPct: marginOf(sales.get(r.id)),
          children: [],
        },
      ]),
    );

    // Attach children, then roll their figures up into the parent.
    const roots: CategoryTreeNode[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    for (const root of roots) rollUp(root, sales);

    const visible = applyFilters(roots, input);
    const total = visible.reduce((sum, r) => sum + r.revenueCents, 0);
    for (const root of visible) setShare(root, total);
    return visible;
  }

  /** Active products per category (own, not rolled up). */
  async #productCounts(orgId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        categoryId: productCategory.categoryId,
        n: sql<number>`count(*)`,
      })
      .from(productCategory)
      .innerJoin(product, eq(product.id, productCategory.productId))
      .innerJoin(category, eq(category.id, productCategory.categoryId))
      .where(and(eq(category.organizationId, orgId), eq(product.status, "active")))
      .groupBy(productCategory.categoryId);
    return new Map(rows.map((r) => [r.categoryId, Number(r.n)]));
  }

  /**
   * Revenue / units / COGS in the window, attributed to **one** category per
   * product. Without that a product sitting in two categories would be counted
   * twice and the per-category totals would exceed the business total.
   * `is_primary` wins; ties (and rows predating the backfill) fall back to the
   * lowest `sort_order`, which is exactly what the backfill script writes.
   */
  async #salesByPrimaryCategory(
    orgId: string,
    input: CategoryTreeInput,
    now: Date,
  ): Promise<Map<string, Aggregate>> {
    const start = daysAgo(now, CATEGORY_PERIOD_DAYS[input.period]);

    const ranked = this.db
      .select({
        productId: productCategory.productId,
        categoryId: productCategory.categoryId,
        rn: sql<number>`row_number() over (
          partition by ${productCategory.productId}
          order by ${productCategory.isPrimary} desc, ${category.sortOrder} asc
        )`.as("rn"),
      })
      .from(productCategory)
      .innerJoin(category, eq(category.id, productCategory.categoryId))
      .where(eq(category.organizationId, orgId))
      .as("ranked");

    const primaryCat = this.db
      .select({ productId: ranked.productId, categoryId: ranked.categoryId })
      .from(ranked)
      .where(eq(ranked.rn, 1))
      .as("primary_cat");

    // Same pre-aggregated recipe cost the dashboard's topProducts uses.
    const variantCogs = this.db
      .select({
        variantId: variantIngredient.variantId,
        cost: sql<number>`sum(${variantIngredient.quantity} * ${ingredient.costPerUnitCents})`.as(
          "cost",
        ),
      })
      .from(variantIngredient)
      .innerJoin(ingredient, eq(ingredient.id, variantIngredient.ingredientId))
      .groupBy(variantIngredient.variantId)
      .as("variant_cogs");

    const rows = await this.db
      .select({
        categoryId: primaryCat.categoryId,
        units: sql<number>`sum(${purchaseItem.qty})`,
        revenue: sql<number>`sum(${purchaseItem.qty} * ${purchaseItem.unitAmountCents})`,
        cogs: sql<number>`sum(${purchaseItem.qty} * coalesce(${variantCogs.cost}, 0))`,
      })
      .from(purchaseItem)
      .innerJoin(purchase, eq(purchase.id, purchaseItem.purchaseId))
      .innerJoin(primaryCat, eq(primaryCat.productId, purchaseItem.productId))
      .leftJoin(variantCogs, eq(variantCogs.variantId, purchaseItem.variantId))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
          ...(input.storeId ? [eq(purchase.storeId, input.storeId)] : []),
        ),
      )
      .groupBy(primaryCat.categoryId);

    return new Map(
      rows.map((r) => [
        r.categoryId,
        {
          revenueCents: Number(r.revenue ?? 0),
          units: Number(r.units ?? 0),
          cogsCents: Number(r.cogs ?? 0),
        },
      ]),
    );
  }

  /** What archiving this category would touch. */
  async usage(orgId: string, id: string): Promise<CategoryUsage> {
    // Promos/rewards/stamp rules reference categories by id inside JSON with no
    // FK, so the only reliable probe is a substring match on the serialized
    // rule. Ids are uuids — a false positive is not a practical concern, and
    // this survives rule-shape changes that a hand-written parser would not.
    const needle = `%${id}%`;
    const [products, children, promos, rewards, stamps] = await Promise.all([
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(productCategory)
        .where(eq(productCategory.categoryId, id)),
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(category)
        .where(and(eq(category.organizationId, orgId), eq(category.parentId, id))),
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(promo)
        .where(
          and(
            eq(promo.organizationId, orgId),
            or(like(promo.rule, needle), like(promo.conditions, needle)),
          ),
        ),
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(reward)
        .where(and(eq(reward.organizationId, orgId), like(reward.benefit, needle))),
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(organizationSettings)
        .where(
          and(
            eq(organizationSettings.organizationId, orgId),
            like(organizationSettings.stampCategoryIds, needle),
          ),
        ),
    ]);

    return {
      products: Number(products[0]?.n ?? 0),
      children: Number(children[0]?.n ?? 0),
      promotions: Number(promos[0]?.n ?? 0),
      rewards: Number(rewards[0]?.n ?? 0),
      stampRules: Number(stamps[0]?.n ?? 0),
    };
  }

  /**
   * Guard for the product upsert: a category with children is a grouping node,
   * not a shelf. Throws with the offending names so the editor can explain.
   */
  async assertAssignable(orgId: string, categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) return;
    const parents = await this.db
      .selectDistinct({ id: category.parentId })
      .from(category)
      .where(
        and(eq(category.organizationId, orgId), inArray(category.parentId, categoryIds)),
      );
    if (parents.length > 0) throw new Error("category-not-assignable");
  }

  // ---- writes --------------------------------------------------------------

  async create(orgId: string, input: CategoryCreateInput): Promise<CategoryCreateResult> {
    const parentId = input.parentId ?? null;
    if (parentId) await this.#requireRoot(orgId, parentId);
    const slug = await this.#resolveSlug(orgId, input.name);
    const id = crypto.randomUUID();
    const plan = parentId ? await this.#planGeneralLeaf(orgId, parentId) : null;
    const nextOrder = await this.#nextSortOrder(orgId, parentId);

    await this.db.transaction(async (tx) => {
      if (plan && parentId) await writeGeneralLeaf(tx, orgId, parentId, plan);
      await tx.insert(category).values({
        id,
        organizationId: orgId,
        parentId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        // The General leaf took slot 0, so the requested child follows it.
        sortOrder: plan ? 1 : nextOrder,
      });
    });

    return {
      id,
      movedCount: plan?.movedCount ?? 0,
      generalLeafId: plan?.id ?? null,
      generalLeafName: plan ? GENERAL_LEAF_NAME : null,
    };
  }

  /**
   * Rename / re-describe / re-parent. The **slug is immutable** — it is part of
   * the customer-facing menu URL and is what promo rules were written against.
   */
  async update(orgId: string, input: CategoryUpdateInput): Promise<CategoryCreateResult> {
    const self = await this.#require(orgId, input.id);
    const nextParentId = input.parentId ?? null;

    const reparenting = nextParentId !== self.parentId;
    let plan: GeneralLeafPlan | null = null;

    if (reparenting && nextParentId) {
      if (nextParentId === self.id) throw new Error("category-self-parent");
      await this.#requireRoot(orgId, nextParentId);
      // Depth 2 means a node that already groups others cannot be nested.
      if (await this.#hasChildren(orgId, self.id)) throw new Error("category-too-deep");
      plan = await this.#planGeneralLeaf(orgId, nextParentId);
    }

    const nextOrder = reparenting ? await this.#nextSortOrder(orgId, nextParentId) : null;

    await this.db.transaction(async (tx) => {
      if (plan && nextParentId) await writeGeneralLeaf(tx, orgId, nextParentId, plan);
      await tx
        .update(category)
        .set({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          parentId: nextParentId,
          ...(nextOrder !== null ? { sortOrder: nextOrder } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(category.organizationId, orgId), eq(category.id, input.id)));
    });

    return {
      id: input.id,
      movedCount: plan?.movedCount ?? 0,
      generalLeafId: plan?.id ?? null,
      generalLeafName: plan ? GENERAL_LEAF_NAME : null,
    };
  }

  /** Soft-delete, cascading to children (flagged so restore can undo exactly this). */
  async archive(orgId: string, id: string): Promise<void> {
    await this.#require(orgId, id);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(category)
        .set({ archivedAt: now, archivedByParent: false, updatedAt: now })
        .where(and(eq(category.organizationId, orgId), eq(category.id, id)));
      await tx
        .update(category)
        .set({ archivedAt: now, archivedByParent: true, updatedAt: now })
        .where(
          and(
            eq(category.organizationId, orgId),
            eq(category.parentId, id),
            isNull(category.archivedAt),
          ),
        );
    });
  }

  async restore(orgId: string, id: string): Promise<void> {
    const self = await this.#require(orgId, id);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(category)
        .set({ archivedAt: null, archivedByParent: false, updatedAt: now })
        .where(and(eq(category.organizationId, orgId), eq(category.id, id)));
      // Revive only the children that went down with this node.
      await tx
        .update(category)
        .set({ archivedAt: null, archivedByParent: false, updatedAt: now })
        .where(
          and(
            eq(category.organizationId, orgId),
            eq(category.parentId, id),
            eq(category.archivedByParent, true),
          ),
        );
      // A restored child under an archived parent would stay invisible.
      if (self.parentId) {
        await tx
          .update(category)
          .set({ archivedAt: null, archivedByParent: false, updatedAt: now })
          .where(and(eq(category.organizationId, orgId), eq(category.id, self.parentId)));
      }
    });
  }

  /** Persist the order of one level (`parentId` null = the roots). */
  async reorder(orgId: string, input: CategoryReorderInput): Promise<void> {
    const siblings = await this.db
      .select({ id: category.id })
      .from(category)
      .where(
        and(
          eq(category.organizationId, orgId),
          input.parentId === null
            ? isNull(category.parentId)
            : eq(category.parentId, input.parentId),
        ),
      );
    const owned = new Set(siblings.map((s) => s.id));
    if (input.ids.some((id) => !owned.has(id))) throw new Error("category-reorder-mismatch");

    const now = new Date();
    await this.db.transaction(async (tx) => {
      for (const [index, id] of input.ids.entries()) {
        // eslint-disable-next-line no-await-in-loop -- one transaction, ordered writes
        await tx
          .update(category)
          .set({ sortOrder: index, updatedAt: now })
          .where(eq(category.id, id));
      }
    });
  }

  // ---- helpers -------------------------------------------------------------

  /**
   * A category about to gain its first child can't keep holding products (only
   * leaves are assignable), so plan a sibling leaf to receive them. Returns null
   * when the parent is already empty — nothing to move, no extra row.
   */
  async #planGeneralLeaf(orgId: string, parentId: string): Promise<GeneralLeafPlan | null> {
    const movedCount = await this.#ownProductCount(parentId);
    if (movedCount === 0) return null;
    const parent = await this.#require(orgId, parentId);
    return {
      id: crypto.randomUUID(),
      slug: await this.#resolveSlug(orgId, `${parent.slug}-general`),
      movedCount,
    };
  }

  async #require(orgId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(category)
      .where(and(eq(category.organizationId, orgId), eq(category.id, id)))
      .limit(1);
    if (!row) throw new Error("category-not-found");
    return row;
  }

  async #requireRoot(orgId: string, id: string) {
    const row = await this.#require(orgId, id);
    if (row.parentId) throw new Error("category-too-deep");
    return row;
  }

  async #hasChildren(orgId: string, id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.organizationId, orgId), eq(category.parentId, id)))
      .limit(1);
    return Boolean(row);
  }

  async #ownProductCount(categoryId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)` })
      .from(productCategory)
      .where(eq(productCategory.categoryId, categoryId));
    return Number(row?.n ?? 0);
  }

  async #nextSortOrder(orgId: string, parentId: string | null): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number | null>`max(${category.sortOrder})` })
      .from(category)
      .where(
        and(
          eq(category.organizationId, orgId),
          parentId === null ? isNull(category.parentId) : eq(category.parentId, parentId),
        ),
      );
    return (row?.max ?? -1) + 1;
  }

  async #resolveSlug(orgId: string, desired: string): Promise<string> {
    const base = slugify(desired) || `categoria-${slugSuffix()}`;
    let candidate = base;
    while (await this.#slugTaken(orgId, candidate)) {
      candidate = `${base}-${slugSuffix()}`;
    }
    return candidate;
  }

  async #slugTaken(orgId: string, slug: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.organizationId, orgId), eq(category.slug, slug)))
      .limit(1);
    return Boolean(row);
  }
}

// ---- pure tree helpers (unit-testable) -------------------------------------

/**
 * Null when there is nothing to divide **or no known COGS** — a category whose
 * products have no recipe would otherwise report a flattering 100% margin. Same
 * rule as the dashboard's topProducts so the two screens never disagree.
 */
function marginOf(agg: Aggregate | undefined): number | null {
  if (!agg || agg.revenueCents === 0 || agg.cogsCents === 0) return null;
  return round1(((agg.revenueCents - agg.cogsCents) / agg.revenueCents) * 100);
}

/**
 * Post-order pass: each node ends up holding its own figures plus every
 * descendant's, and returns the subtree aggregate so the parent can add it.
 * Margin is recomputed from the summed revenue/COGS — averaging child
 * percentages would weight a $10 category the same as a $10.000 one.
 */
function rollUp(node: CategoryTreeNode, sales: Map<string, Aggregate>): Aggregate {
  node.children.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const own = sales.get(node.id);
  const total: Aggregate = {
    revenueCents: own?.revenueCents ?? 0,
    units: own?.units ?? 0,
    cogsCents: own?.cogsCents ?? 0,
  };
  for (const child of node.children) {
    const sub = rollUp(child, sales);
    node.productCount += child.productCount;
    total.revenueCents += sub.revenueCents;
    total.units += sub.units;
    total.cogsCents += sub.cogsCents;
  }
  node.revenueCents = total.revenueCents;
  node.units = total.units;
  node.marginPct = marginOf(total);
  return total;
}

function setShare(node: CategoryTreeNode, total: number): void {
  node.sharePct = total === 0 ? 0 : round1((node.revenueCents / total) * 100);
  for (const child of node.children) setShare(child, total);
}

/**
 * Status + search, applied to the assembled tree. A matching child keeps its
 * parent visible so the group header still frames it (the picker renders parents
 * as headers), and a matching parent keeps all of its children.
 */
function applyFilters(roots: CategoryTreeNode[], input: CategoryTreeInput): CategoryTreeNode[] {
  const needle = input.search?.trim().toLowerCase();
  const statusOk = (n: CategoryTreeNode) =>
    input.status === "all"
      ? true
      : input.status === "archived"
        ? n.archivedAt !== null
        : n.archivedAt === null;
  const matches = (n: CategoryTreeNode) =>
    !needle ||
    n.name.toLowerCase().includes(needle) ||
    (n.description ?? "").toLowerCase().includes(needle);

  const keep = (node: CategoryTreeNode): CategoryTreeNode | null => {
    const survivingChildren = node.children
      .map(keep)
      .filter((c): c is CategoryTreeNode => c !== null);
    const selfMatches = statusOk(node) && matches(node);
    if (!selfMatches && survivingChildren.length === 0) return null;
    // A node that matches on its own keeps every child allowed by the status
    // filter; one surfaced only to frame a matching child shows just that child.
    return {
      ...node,
      children: selfMatches ? node.children.filter(statusOk) : survivingChildren,
    };
  };

  return roots.map(keep).filter((n): n is CategoryTreeNode => n !== null);
}

export const __treeInternals = { applyFilters, rollUp, setShare, marginOf };
