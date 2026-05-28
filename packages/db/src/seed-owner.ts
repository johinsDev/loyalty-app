import { promoteOwnerByEmail } from "./seed-helpers";

/**
 * CLI: promote an existing user to `owner` of the singleton
 * operator org.
 *
 * Usage:
 *   bun run db:seed:owner --email=johan@example.com
 *
 * The actual logic lives in `./seed-helpers.ts` so other scripts can
 * reuse it without triggering this CLI bootstrap on import.
 */
async function main() {
  const email = process.argv
    .find((arg) => arg.startsWith("--email="))
    ?.slice("--email=".length);
  if (!email) {
    console.error("Usage: bun run db:seed:owner --email=<email>");
    process.exit(1);
  }
  await promoteOwnerByEmail(email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
