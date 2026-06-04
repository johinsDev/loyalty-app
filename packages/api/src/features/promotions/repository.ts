import type { db as Db } from "@loyalty/db";
import { promo, type PromoInsert, type PromoRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, like, sql } from "drizzle-orm";

import type { ListInput } from "./schemas";

export interface ListResult {
  rows: PromoRow[];
  total: number;
}

/** Slice of a promo a step may write. Excludes identity + lifecycle columns. */
type PromoPatch = Partial<
  Pick<
    PromoInsert,
    "name" | "segmentId" | "productIds" | "branding" | "startsAt" | "endsAt"
  >
>;

/**
 * Drizzle access for `promo`. The only layer that touches the db. Every read +
 * write is scoped by `organizationId` so a draft can never leak across tenants.
 */
export class PromoRepository {
  constructor(private readonly db: typeof Db) {}

  async createDraft(
    organizationId: string,
    createdByUserId: string,
  ): Promise<PromoRow> {
    const rows = await this.db
      .insert(promo)
      .values({ organizationId, createdByUserId })
      .returning();
    return this.#first(rows, "insert");
  }

  async findById(organizationId: string, id: string): Promise<PromoRow | null> {
    const rows = await this.db
      .select()
      .from(promo)
      .where(and(eq(promo.id, id), eq(promo.organizationId, organizationId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async patch(
    organizationId: string,
    id: string,
    patch: PromoPatch,
  ): Promise<PromoRow> {
    const rows = await this.db
      .update(promo)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(promo.id, id), eq(promo.organizationId, organizationId)))
      .returning();
    return this.#first(rows, "patch");
  }

  async markPublished(organizationId: string, id: string): Promise<PromoRow> {
    const now = new Date();
    const rows = await this.db
      .update(promo)
      .set({ status: "published", publishedAt: now, updatedAt: now })
      .where(and(eq(promo.id, id), eq(promo.organizationId, organizationId)))
      .returning();
    return this.#first(rows, "publish");
  }

  async list(organizationId: string, input: ListInput): Promise<ListResult> {
    const offset = (input.page - 1) * input.pageSize;
    const conds = [eq(promo.organizationId, organizationId)];
    if (input.status) conds.push(eq(promo.status, input.status));
    if (input.search) conds.push(like(promo.name, `%${input.search}%`));
    const where = and(...conds);

    const rows = (await this.db
      .select()
      .from(promo)
      .where(where)
      .orderBy(desc(promo.updatedAt))
      .limit(input.pageSize)
      .offset(offset)) as PromoRow[];

    const countRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(promo)
      .where(where);

    return { rows, total: countRows[0]?.value ?? 0 };
  }

  #first(rows: PromoRow[], op: string): PromoRow {
    const row = rows[0];
    if (!row) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `promo ${op} returned no row`,
      });
    }
    return row;
  }
}
