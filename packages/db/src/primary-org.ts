import { asc } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";

let cached: string | undefined;

/**
 * The principal organization id — the first organization ever created.
 *
 * This is a single-tenant pilot (one franchise → one `organization`, seeded as
 * `t4-diverplaza`), so "the first org" IS the org. Resolving it from the DB
 * replaces the old `LOYALTY_ORG_ID` env var, which was fragile: it had to be
 * set correctly in every runtime (web / admin / jobs) and per deploy, and a
 * mismatch silently broke customer provisioning + the admin picker.
 *
 * Cached after the first successful lookup (the principal org never changes).
 * Returns `null` only on a brand-new DB with no organization yet — callers
 * treat that as "not ready" rather than caching it.
 */
export async function getPrimaryOrganizationId(): Promise<string | null> {
  if (cached) return cached;
  const rows = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .orderBy(asc(schema.organization.createdAt), asc(schema.organization.id))
    .limit(1);
  const id = rows[0]?.id ?? null;
  if (id) cached = id;
  return id;
}
