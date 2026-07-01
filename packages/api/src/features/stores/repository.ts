import type { db as Db } from "@loyalty/db";
import { store, type StoreRow } from "@loyalty/db/schema";
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql } from "drizzle-orm";

import { buildOrderBy, type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type { StoreListItem, StoresListInput } from "./schemas";

type StorePatch = Partial<typeof store.$inferInsert>;

/** Columns the admin table may sort by (id → Drizzle column). */
const SORTABLE = {
  name: store.name,
  status: store.status,
  createdAt: store.createdAt,
};

function toItem(r: StoreRow): StoreListItem {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    status: r.status,
    isPrimary: r.isPrimary,
    isPublished: r.isPublished,
    createdAt: r.createdAt,
  };
}

/** Drizzle access for `store`. Only layer that touches the db; org-scoped.
 *  Every read excludes soft-deleted rows (`deletedAt IS NOT NULL`). */
export class StoresRepository {
  constructor(private readonly db: typeof Db) {}

  async list(orgId: string, publishedOnly = false): Promise<StoreRow[]> {
    const conds = [eq(store.organizationId, orgId), isNull(store.deletedAt)];
    if (publishedOnly) {
      conds.push(eq(store.status, "published"), eq(store.isPublished, true));
    }
    return this.db
      .select()
      .from(store)
      .where(and(...conds))
      .orderBy(desc(store.isPrimary), asc(store.sortOrder), asc(store.createdAt));
  }

  /** Paginated/filtered/sorted list for the admin data-table. */
  async adminList(orgId: string, input: StoresListInput): Promise<ListResult<StoreListItem>> {
    const conds = [eq(store.organizationId, orgId), isNull(store.deletedAt)];
    if (input.q) {
      const term = `%${input.q}%`;
      conds.push(or(like(store.name, term), like(store.address, term), like(store.phone, term))!);
    }
    if (input.status?.length) conds.push(inArray(store.status, input.status));
    if (input.visible?.length) conds.push(inArray(store.isPublished, input.visible));
    if (input.primary) conds.push(eq(store.isPrimary, input.primary === "primary"));
    if (input.createdFrom) conds.push(gte(store.createdAt, input.createdFrom));
    if (input.createdTo) conds.push(lte(store.createdAt, input.createdTo));
    const where = and(...conds);

    const orderBy = buildOrderBy(input.sort, SORTABLE, [
      desc(store.isPrimary),
      asc(store.sortOrder),
      asc(store.createdAt),
    ]);

    const rows = await this.db
      .select()
      .from(store)
      .where(where)
      .orderBy(...orderBy)
      .limit(input.perPage)
      .offset(pageOffset(input.page, input.perPage));
    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(store)
      .where(where);
    const total = totalRows[0]?.value ?? 0;
    return { rows: rows.map(toItem), total, pageCount: pageCountOf(total, input.perPage) };
  }

  /** Lean rows for the given ids (used by CSV export of a selection). */
  async listByIds(orgId: string, ids: string[]): Promise<StoreListItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(store)
      .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt), inArray(store.id, ids)));
    return rows.map(toItem);
  }

  async get(orgId: string, id: string): Promise<StoreRow | null> {
    const rows = await this.db
      .select()
      .from(store)
      .where(and(eq(store.id, id), eq(store.organizationId, orgId), isNull(store.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPrimary(orgId: string, publishedOnly = false): Promise<StoreRow | null> {
    const rows = await this.list(orgId, publishedOnly);
    return rows.find((s) => s.isPrimary) ?? rows[0] ?? null;
  }

  /** Count of non-deleted stores (drafts included). */
  async countActive(orgId: string): Promise<number> {
    const rows = await this.db
      .select({ id: store.id })
      .from(store)
      .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt)));
    return rows.length;
  }

  async create(orgId: string, values: StorePatch & { name: string }): Promise<StoreRow> {
    const isFirst = (await this.countActive(orgId)) === 0;
    const rows = await this.db
      .insert(store)
      .values({ ...values, organizationId: orgId, isPrimary: values.isPrimary ?? isFirst })
      .returning();
    return rows[0]!;
  }

  async patch(orgId: string, id: string, values: StorePatch): Promise<StoreRow> {
    const rows = await this.db
      .update(store)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(store.id, id), eq(store.organizationId, orgId), isNull(store.deletedAt)))
      .returning();
    return rows[0]!;
  }

  /** Make `id` the only primary store of the org. */
  async setPrimary(orgId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(store)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt)));
      await tx
        .update(store)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(eq(store.id, id), eq(store.organizationId, orgId)));
    });
  }

  /** Promote the next non-deleted store (other than `excludeId`) to primary. */
  async promoteAnotherPrimary(orgId: string, excludeId: string): Promise<void> {
    const rows = await this.db
      .select({ id: store.id })
      .from(store)
      .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt), ne(store.id, excludeId)))
      .orderBy(asc(store.sortOrder), asc(store.createdAt))
      .limit(1);
    const next = rows[0];
    if (next) {
      await this.db
        .update(store)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(eq(store.id, next.id), eq(store.organizationId, orgId)));
    }
  }

  async softDelete(orgId: string, id: string): Promise<void> {
    await this.db
      .update(store)
      .set({ deletedAt: new Date(), isPrimary: false, updatedAt: new Date() })
      .where(and(eq(store.id, id), eq(store.organizationId, orgId)));
  }

  async bulkSoftDelete(orgId: string, ids: string[]): Promise<void> {
    await this.db
      .update(store)
      .set({ deletedAt: new Date(), isPrimary: false, updatedAt: new Date() })
      .where(and(eq(store.organizationId, orgId), inArray(store.id, ids)));
  }

  async bulkSetPublished(orgId: string, ids: string[], isPublished: boolean): Promise<void> {
    await this.db
      .update(store)
      .set({ isPublished, updatedAt: new Date() })
      .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt), inArray(store.id, ids)));
  }

  /** Ensure the org has a primary store when at least one non-deleted remains. */
  async ensurePrimary(orgId: string): Promise<void> {
    const rows = await this.list(orgId, false);
    if (rows.length === 0 || rows.some((s) => s.isPrimary)) return;
    await this.db
      .update(store)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(and(eq(store.id, rows[0]!.id), eq(store.organizationId, orgId)));
  }
}
