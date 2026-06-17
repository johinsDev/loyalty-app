import { ne } from "drizzle-orm";

import { db } from "./client";
import * as schema from "./schema";

/**
 * CLI: wipe loyalty test data from a LOCAL dev DB so the onboarding can be
 * re-tested from scratch. Keeps the operator org and the admin user; deletes
 * every customer + every non-admin user (cascading sessions/accounts/members/
 * cards/stamps/push-tokens/notifications) + pending verification tokens.
 *
 *   bun run db:reset:test
 *
 * Guarded to localhost only — refuses to run against a remote/prod DATABASE_URL.
 */
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    console.error(
      `✗ Refusing to reset: DATABASE_URL is not local (${url || "unset"}). This is a dev-only command.`,
    );
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_PREVIEW_EMAIL ?? "admin@preview.test";

  const customers = await db.delete(schema.customer);
  const users = await db.delete(schema.user).where(ne(schema.user.email, adminEmail));
  const verifications = await db.delete(schema.verification);

  const orgs = await db.select().from(schema.organization);
  const remainingUsers = await db
    .select({ email: schema.user.email })
    .from(schema.user);

  console.log(
    `✓ Reset: deleted ${customers.rowsAffected} customers, ${users.rowsAffected} non-admin users, ${verifications.rowsAffected} verification tokens.`,
  );
  console.log(
    `  Kept: org=${orgs.map((o) => o.slug).join(",") || "none"} · users=${remainingUsers.map((u) => u.email).join(",") || "none"}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
