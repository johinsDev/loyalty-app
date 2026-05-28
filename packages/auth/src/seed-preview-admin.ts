import { db, promoteOwnerByEmail, schema } from "@loyalty/db";
import { eq } from "drizzle-orm";

import { createAuth } from "./server";

/**
 * CI / dev seed: create a deterministic admin user in preview/dev
 * environments so anyone can log into a per-PR preview without going
 * through Google OAuth. Idempotent — re-run safely (e.g. on every PR
 * push, since preview DBs are reused-if-exist).
 *
 * **NEVER run in production.** The provider that authenticates this
 * user (email/password) is disabled in prod via
 * `apps/admin/src/lib/auth-flags.ts`. Belt-and-suspenders: this script
 * is only invoked from the preview workflow (`.github/workflows/preview.yml`)
 * and the local `db:seed:preview-admin` command, never from a prod path.
 *
 * Credentials come from Infisical (path `/shared` in `dev` and
 * `staging` envs): `ADMIN_PREVIEW_EMAIL`, `ADMIN_PREVIEW_PASSWORD`.
 *
 * Steps:
 *   1. Validate required env.
 *   2. If a user with this email already exists, skip sign-up.
 *      Otherwise call Better Auth's server API to create the user +
 *      password account (scrypt-hashed by Better Auth itself).
 *   3. Promote the user to `owner` of the singleton operator org —
 *      otherwise the admin role gate rejects sign-in with `?error=forbidden`.
 */

async function main(): Promise<void> {
  const email = process.env.ADMIN_PREVIEW_EMAIL;
  const password = process.env.ADMIN_PREVIEW_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ADMIN_PREVIEW_EMAIL and ADMIN_PREVIEW_PASSWORD must be set (Infisical /shared in dev + staging).",
    );
  }

  const auth = createAuth({}, { emailAndPasswordEnabled: true });

  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  if (existing) {
    console.log(`✓ Preview admin ${email} already exists — skipping sign-up.`);
  } else {
    await auth.api.signUpEmail({
      body: { email, password, name: "Preview Admin" },
    });
    console.log(`✨ Created preview admin user ${email}.`);
  }

  await promoteOwnerByEmail(email);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
