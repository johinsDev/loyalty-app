import { eq } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";

/**
 * Bootstrap script: promote a user to `owner` of the singleton org.
 * Idempotent — re-run safely.
 *
 * Usage:
 *   bun run db:seed:owner --email=johan@example.com
 *
 * Steps:
 *   1. Find or create the singleton "t4-diverplaza" organization.
 *   2. Look up the user by email (must have signed up first).
 *   3. Insert or update their `member` row with `role=owner`.
 *
 * v1 assumes one org — T4 Diverplaza (the franchise piloting the
 * loyalty program). When the SaaS opens up to other franchises this
 * script grows a `--org=<slug>` flag.
 */

async function main() {
  const email = process.argv
    .find((arg) => arg.startsWith("--email="))
    ?.slice("--email=".length);
  if (!email) {
    console.error('Usage: bun run db:seed:owner --email=<email>');
    process.exit(1);
  }

  // 1. Find or create the operator org.
  const existingOrgs = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.slug, "t4-diverplaza"))
    .limit(1);
  let org = existingOrgs[0];
  if (!org) {
    const inserted = await db
      .insert(schema.organization)
      .values({
        id: crypto.randomUUID(),
        name: "T4 Diverplaza",
        slug: "t4-diverplaza",
      })
      .returning();
    org = inserted[0];
    if (!org) {
      throw new Error("Failed to insert operator organization");
    }
    console.log(`✨ Created operator organization (id=${org.id})`);
  }

  // 2. Look up the user by email.
  const [user] = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  if (!user) {
    console.error(
      `❌ No user with email ${email}. Sign up first via /sign-in.`,
    );
    process.exit(1);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
