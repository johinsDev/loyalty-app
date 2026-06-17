import { ensurePrimaryOrg } from "./seed-helpers";

/**
 * CLI: ensure the singleton operator org (`t4-diverplaza`) exists.
 *
 * Usage:
 *   bun run db:seed:org
 *
 * A fresh local DB has no organization, so `getPrimaryOrganizationId()` returns
 * null and customer provisioning (phone-OTP signup) silently no-ops — the user
 * lands on /complete-phone forever. Run this once after migrating a fresh dev DB.
 * Idempotent. (`db:seed:owner` also creates it, but needs an existing user.)
 */
async function main() {
  const org = await ensurePrimaryOrg();
  console.log(`✓ Operator org ready: ${org.slug} (id=${org.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
