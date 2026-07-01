import { eq } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";

/**
 * Bootstrap helper: promote a user (by email) to `owner` of the
 * singleton operator org. Idempotent — re-run safely.
 *
 * Steps:
 *   1. Find or create the singleton "t4-diverplaza" organization.
 *   2. Look up the user by email (must already exist — sign up first).
 *   3. Insert or update their `member` row with `role=owner`.
 *
 * Lives in its own (side-effect-free) module so other seed scripts —
 * e.g. `packages/auth/src/seed-preview-admin.ts`, which creates a user
 * via Better Auth and then needs to promote it — can import it without
 * the CLI bootstrap in `seed-owner.ts` running on import.
 *
 * v1 assumes one org — T4 Diverplaza (the franchise piloting the
 * loyalty program). When the SaaS opens up to other franchises this
 * grows an `orgSlug` parameter.
 */
/**
 * Find or create the singleton operator org (`t4-diverplaza`). Idempotent.
 * This is the one row the whole pilot hangs off — customer provisioning
 * (`getPrimaryOrganizationId`) returns null until it exists, so a fresh local
 * DB needs this seeded before the customer onboarding can complete.
 */
export async function ensurePrimaryOrg(): Promise<
  typeof schema.organization.$inferSelect
> {
  const existingOrgs = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.slug, "t4-diverplaza"))
    .limit(1);
  const existing = existingOrgs[0];
  if (existing) return existing;
  const inserted = await db
    .insert(schema.organization)
    .values({
      id: crypto.randomUUID(),
      name: "T4 Diverplaza",
      slug: "t4-diverplaza",
    })
    .returning();
  const org = inserted[0];
  if (!org) throw new Error("Failed to insert operator organization");
  console.log(`✨ Created operator organization (id=${org.id})`);
  return org;
}

export async function promoteOwnerByEmail(email: string): Promise<void> {
  // 1. Find or create the operator org.
  const org = await ensurePrimaryOrg();

  // 2. Look up the user by email.
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (!user) {
    throw new Error(
      `No user with email ${email}. Sign up first via /sign-in.`,
    );
  }

  // The Better Auth `admin` plugin gates impersonation / ban / list-sessions on
  // `user.role === "admin"` (distinct from the org `member.role`). The owner is
  // the only operator who impersonates, so mirror "admin" onto their user row.
  if (user.role !== "admin") {
    await db
      .update(schema.user)
      .set({ role: "admin" })
      .where(eq(schema.user.id, user.id));
  }

  // 3. Upsert the member row with role=owner.
  const [existing] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, user.id))
    .limit(1);
  if (existing) {
    if (existing.role === "owner") {
      console.log(`✓ ${email} is already an owner — nothing to do.`);
      return;
    }
    await db
      .update(schema.member)
      .set({ role: "owner" })
      .where(eq(schema.member.id, existing.id));
    console.log(`✅ ${email} promoted from "${existing.role}" to "owner".`);
    return;
  }
  await db.insert(schema.member).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    userId: user.id,
    role: "owner",
  });
  console.log(`✅ ${email} is now an owner of "${org.slug}".`);
}
