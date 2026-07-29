import type { db as Db } from "@loyalty/db";
import { category } from "@loyalty/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Category hierarchy resolution, shared by every read that filters by category.
 *
 * Products are only ever attached to **leaves**, so a naive `categoryId = X`
 * filter returns nothing whenever X is a grouping node. Two directions fix that,
 * and both need the same parent map:
 *
 * - {@link withDescendants} — "show me everything under Milk Tea": expands a
 *   selected category into itself plus its children (menu filter, admin facet).
 * - {@link withAncestors} — "which categories does this product count for":
 *   expands a product's own categories with their parents, so a promo, stamp
 *   rule or chip written against a root still matches (rollup).
 *
 * The tree is two levels deep and dozens of rows, so it is loaded whole and
 * resolved in memory — one round trip, no recursive SQL.
 */
export interface CategoryAncestry {
  parentOf: Map<string, string | null>;
  childrenOf: Map<string, string[]>;
  idBySlug: Map<string, string>;
}

const EMPTY: CategoryAncestry = {
  parentOf: new Map(),
  childrenOf: new Map(),
  idBySlug: new Map(),
};

export async function loadCategoryAncestry(
  db: typeof Db,
  orgId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<CategoryAncestry> {
  const rows = await db
    .select({ id: category.id, parentId: category.parentId, slug: category.slug })
    .from(category)
    .where(
      includeArchived
        ? eq(category.organizationId, orgId)
        : and(eq(category.organizationId, orgId), isNull(category.archivedAt)),
    );
  if (rows.length === 0) return EMPTY;

  const parentOf = new Map<string, string | null>();
  const childrenOf = new Map<string, string[]>();
  const idBySlug = new Map<string, string>();
  for (const row of rows) {
    parentOf.set(row.id, row.parentId);
    idBySlug.set(row.slug, row.id);
    if (row.parentId) {
      const siblings = childrenOf.get(row.parentId);
      if (siblings) siblings.push(row.id);
      else childrenOf.set(row.parentId, [row.id]);
    }
  }
  return { parentOf, childrenOf, idBySlug };
}

/** The given categories plus everything nested under them (depth 2 → one hop). */
export function withDescendants(ancestry: CategoryAncestry, ids: string[]): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    for (const child of ancestry.childrenOf.get(id) ?? []) out.add(child);
  }
  return [...out];
}

/** The given categories plus their parents — a product's effective membership. */
export function withAncestors(ancestry: CategoryAncestry, ids: string[]): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    const parent = ancestry.parentOf.get(id);
    if (parent) out.add(parent);
  }
  return [...out];
}

/** Resolve a slug to its id plus descendants; empty when the slug is unknown. */
export function idsForSlug(ancestry: CategoryAncestry, slug: string): string[] {
  const id = ancestry.idBySlug.get(slug);
  return id ? withDescendants(ancestry, [id]) : [];
}
