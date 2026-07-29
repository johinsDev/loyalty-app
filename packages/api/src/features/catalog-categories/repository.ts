import type { db as Db } from "@loyalty/db";
import { catalogCategory } from "@loyalty/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

import type {
  CatalogCategoryCreateInput,
  CatalogCategoryKind,
  CatalogCategoryRow,
  CatalogCategoryUpdateInput,
} from "./schemas";

export class CatalogCategoriesRepository {
  constructor(private readonly db: typeof Db) {}

  /**
   * Categories of one kind with their member counts. `productCount` answers
   * "how many products would this change affect?" — only meaningful for add-on
   * categories, since an `addon_group` with `source = 'category'` resolves its
   * membership through here at render time.
   */
  async list(orgId: string, kind: CatalogCategoryKind): Promise<CatalogCategoryRow[]> {
    // NOTE: the column references here are written out fully qualified on
    // purpose. Interpolating drizzle column objects into a raw `sql` template
    // renders them UNQUALIFIED (`where "category_id" = "id"`), which inside a
    // correlated subquery silently binds "id" to the inner table and makes
    // every count come back 0.
    const memberExpr =
      kind === "addon"
        ? sql<number>`(select count(*) from "addon" where "addon"."category_id" = "catalog_category"."id")`
        : sql<number>`(select count(*) from "ingredient" where "ingredient"."category_id" = "catalog_category"."id")`;
    const productExpr =
      kind === "addon"
        ? sql<number>`(select count(distinct "addon_group"."product_id") from "addon_group" where "addon_group"."category_id" = "catalog_category"."id")`
        : sql<number>`0`;

    const rows = await this.db
      .select({
        id: catalogCategory.id,
        kind: catalogCategory.kind,
        name: catalogCategory.name,
        sortOrder: catalogCategory.sortOrder,
        memberCount: memberExpr,
        productCount: productExpr,
      })
      .from(catalogCategory)
      .where(
        and(eq(catalogCategory.organizationId, orgId), eq(catalogCategory.kind, kind)),
      )
      .orderBy(asc(catalogCategory.sortOrder), asc(catalogCategory.name));

    return rows.map((r) => ({
      ...r,
      kind: r.kind as CatalogCategoryKind,
      memberCount: Number(r.memberCount ?? 0),
      productCount: Number(r.productCount ?? 0),
    }));
  }

  async create(
    orgId: string,
    input: CatalogCategoryCreateInput,
  ): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await this.db.insert(catalogCategory).values({
      id,
      organizationId: orgId,
      kind: input.kind,
      name: input.name,
      sortOrder: input.sortOrder,
    });
    return { id };
  }

  async update(orgId: string, input: CatalogCategoryUpdateInput): Promise<void> {
    await this.db
      .update(catalogCategory)
      .set({ name: input.name, sortOrder: input.sortOrder, updatedAt: new Date() })
      .where(
        and(eq(catalogCategory.organizationId, orgId), eq(catalogCategory.id, input.id)),
      );
  }

  /** Both member FKs are `set null`, so removing a category unfiles its entries
   *  rather than deleting them. Add-on groups pointing here resolve to empty. */
  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(catalogCategory)
      .where(and(eq(catalogCategory.organizationId, orgId), eq(catalogCategory.id, id)));
  }
}
