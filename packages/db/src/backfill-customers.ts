import { isNotNull } from "drizzle-orm";

import { db } from "./client";
import { provisionCustomerForUser } from "./customer-provision";
import { getPrimaryOrganizationId } from "./primary-org";
import * as schema from "./schema";

/**
 * CLI: one-time backfill of `customer` rows for existing web `user`s that
 * have a phone number but no matching customer (sign-up provisioning was
 * added after they registered). Idempotent — safe to re-run.
 *
 * Usage:
 *   bun run db:backfill-customers
 *
 * Resolves the principal org from the DB (first organization). Going forward
 * the Better Auth sign-up hook provisions customers automatically.
 */
async function main() {
  const organizationId = await getPrimaryOrganizationId();
  if (!organizationId) {
    console.error("No organization found — seed the operator org first.");
    process.exit(1);
  }

  const users = await db
    .select()
    .from(schema.user)
    .where(isNotNull(schema.user.phoneNumber));

  let created = 0;
  for (const user of users) {
    if (!user.phoneNumber) continue;
    const inserted = await provisionCustomerForUser({
      userId: user.id,
      organizationId,
      phone: user.phoneNumber,
      email: user.email,
      name: user.name,
    });
    if (inserted) created += 1;
  }

  console.log(
    `✅ Backfilled ${created} customer(s) from ${users.length} phone user(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
