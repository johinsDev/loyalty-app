import type { Role } from "@loyalty/auth/server";
import type { db as Db } from "@loyalty/db";
import { store, storeStaff } from "@loyalty/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

/**
 * Resolve the active store for a register action (recordPurchase / reward claim).
 * The register's store-switcher sends the cashier's chosen store; we fall back to
 * the cashier's first assigned store, then the org's primary, then the oldest
 * store. Throws if the org has no store at all (a sale can't be attributed).
 * Every loyalty write is stamped with the returned id.
 *
 * `role` decides how far `requested` is trusted. This used to accept any store in
 * the org on the theory that "the UI limits it to the cashier's assignments" —
 * but the UI is not a boundary, so a stale device default or a hand-made request
 * could attribute revenue to a location the cashier doesn't work at. Staff now
 * have to be assigned to the store they name; managers and owners supervise
 * every location, so any org store still stands.
 */
export async function resolveActiveStoreId(
  db: typeof Db,
  orgId: string,
  userId: string,
  requested?: string | null,
  role?: Role,
): Promise<string> {
  if (requested) {
    const base = and(
      eq(store.id, requested),
      eq(store.organizationId, orgId),
      isNull(store.deletedAt),
    );
    const rows =
      role === "staff"
        ? await db
            .select({ id: store.id })
            .from(store)
            .innerJoin(
              storeStaff,
              and(
                eq(storeStaff.storeId, store.id),
                eq(storeStaff.userId, userId),
                eq(storeStaff.organizationId, orgId),
              ),
            )
            .where(base)
            .limit(1)
        : await db.select({ id: store.id }).from(store).where(base).limit(1);
    if (rows[0]) return rows[0].id;
  }

  const assigned = await db
    .select({ id: storeStaff.storeId })
    .from(storeStaff)
    .innerJoin(store, eq(store.id, storeStaff.storeId))
    .where(
      and(
        eq(storeStaff.organizationId, orgId),
        eq(storeStaff.userId, userId),
        isNull(store.deletedAt),
      ),
    )
    .limit(1);
  if (assigned[0]) return assigned[0].id;

  const fallback = await db
    .select({ id: store.id })
    .from(store)
    .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt)))
    .orderBy(desc(store.isPrimary), asc(store.createdAt))
    .limit(1);
  if (fallback[0]) return fallback[0].id;

  throw new Error("No store available to attribute this action to.");
}
