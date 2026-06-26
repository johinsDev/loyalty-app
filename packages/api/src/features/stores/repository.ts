import type { db as Db } from "@loyalty/db";
import { store, type StoreRow } from "@loyalty/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

type StorePatch = Partial<typeof store.$inferInsert>;

/** Drizzle access for `store`. Only layer that touches the db; org-scoped. */
export class StoresRepository {
  constructor(private readonly db: typeof Db) {}

  async list(orgId: string, publishedOnly = false): Promise<StoreRow[]> {
    const conds = [eq(store.organizationId, orgId)];
    if (publishedOnly) conds.push(eq(store.isPublished, true));
    return this.db
      .select()
      .from(store)
      .where(and(...conds))
      .orderBy(desc(store.isPrimary), asc(store.sortOrder), asc(store.createdAt));
  }

  async get(orgId: string, id: string): Promise<StoreRow | null> {
    const rows = await this.db
      .select()
      .from(store)
      .where(and(eq(store.id, id), eq(store.organizationId, orgId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPrimary(orgId: string, publishedOnly = false): Promise<StoreRow | null> {
    const rows = await this.list(orgId, publishedOnly);
    return rows.find((s) => s.isPrimary) ?? rows[0] ?? null;
  }

  async count(orgId: string): Promise<number> {
    const rows = await this.db
      .select({ id: store.id })
      .from(store)
      .where(eq(store.organizationId, orgId));
    return rows.length;
  }

  async create(orgId: string, values: StorePatch & { name: string }): Promise<StoreRow> {
    const isFirst = (await this.count(orgId)) === 0;
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
      .where(and(eq(store.id, id), eq(store.organizationId, orgId)))
      .returning();
    return rows[0]!;
  }

  /** Make `id` the only primary store of the org. */
  async setPrimary(orgId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(store)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(store.organizationId, orgId));
      await tx
        .update(store)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(and(eq(store.id, id), eq(store.organizationId, orgId)));
    });
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db.delete(store).where(and(eq(store.id, id), eq(store.organizationId, orgId)));
  }
}
