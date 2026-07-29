import { z } from "zod";

/**
 * Category tree contracts. Client-safe (no server imports) so admin components
 * can type against them — exported via the `./features/categories/schemas`
 * subpath, like stores does.
 *
 * The tree is **two levels**: roots and their children. Only **leaves** accept
 * products; a category that gains a child stops being assignable and its
 * products are moved to an auto-created "General" leaf.
 */

/** Which slice of the catalog to list. Archiving is a soft delete. */
export const categoryStatusFilter = z.enum(["active", "archived", "all"]);
export type CategoryStatusFilter = z.infer<typeof categoryStatusFilter>;

/** Metric window for the per-row business figures. Mirrors the dashboard's. */
export const categoryPeriod = z.enum(["7d", "30d", "90d"]);
export type CategoryPeriod = z.infer<typeof categoryPeriod>;

export const CATEGORY_PERIOD_DAYS: Record<CategoryPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/** Max depth of the hierarchy: a root and one level of children. */
export const CATEGORY_MAX_DEPTH = 2;

export const categoryTreeInputSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: categoryStatusFilter.default("active"),
  period: categoryPeriod.default("30d"),
  /** `null`/undefined = every store (metrics only; the tree itself is org-wide). */
  storeId: z.string().nullish(),
  /** The management screen wants revenue/units/margin; the product picker only
   *  needs product counts — skipping the sales scan keeps the picker snappy. */
  metrics: z.boolean().default(true),
});
export type CategoryTreeInput = z.infer<typeof categoryTreeInputSchema>;

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).optional(),
  /** When set, creates a child of this category (which must be a root). */
  parentId: z.string().min(1).nullish(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema.extend({
  id: z.string().min(1),
});
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

/** Reorder one level at a time: the children of `parentId` (null = the roots). */
export const categoryReorderSchema = z.object({
  parentId: z.string().min(1).nullable(),
  ids: z.array(z.string().min(1)).min(1).max(200),
});
export type CategoryReorderInput = z.infer<typeof categoryReorderSchema>;

export const categoryIdSchema = z.object({ id: z.string().min(1) });

/** Per-category business figures over the requested window. */
export interface CategoryMetrics {
  /** Assigned products (active only), rolled up into parents. */
  productCount: number;
  revenueCents: number;
  units: number;
  /** (revenue - COGS) / revenue, 1 decimal. Null when revenue is 0 or no recipe. */
  marginPct: number | null;
  /** Share of the window's attributed revenue, 1 decimal. */
  sharePct: number;
}

export interface CategoryTreeNode extends CategoryMetrics {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  archivedAt: Date | null;
  archivedByParent: boolean;
  /** Leaves accept products; nodes with children do not. */
  isLeaf: boolean;
  children: CategoryTreeNode[];
}

/** What an archive would affect. The JSON-rule counts have no FK behind them. */
export interface CategoryUsage {
  products: number;
  children: number;
  promotions: number;
  rewards: number;
  stampRules: number;
}

/** Result of a create that had to convert a populated category into a parent. */
export interface CategoryCreateResult {
  id: string;
  /** Products moved out of the parent into the auto-created leaf (0 = none). */
  movedCount: number;
  /** The auto-created "General" leaf, when one was needed. */
  generalLeafId: string | null;
  generalLeafName: string | null;
}
