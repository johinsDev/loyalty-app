// Create a per-PR preview database cloned from prod, mint an auth token, and
// emit the connection details. The preview pipeline then runs migrations +
// mask-preview-db against it and pins DATABASE_URL/TURSO_AUTH_TOKEN on the
// Vercel preview.
//
// Usage:
//   PR_NUMBER=123 bun run scripts/db/create-preview-db.ts
//
// Env:
//   PR_NUMBER          the PR number (or pass as argv[2])
//   PREVIEW_SOURCE_DB  prod database name to clone (default: loyalty-app)
//   TURSO_ORG / TURSO_API_TOKEN  (see turso-api.ts)
//
// Output: prints `DATABASE_URL=…` / `TURSO_AUTH_TOKEN=…`. In GitHub Actions
// ($GITHUB_OUTPUT set) it writes masked outputs (database_url, auth_token,
// db_name) and keeps the token out of the plain logs.

import { appendFileSync } from "node:fs";

import {
  createPreviewDatabase,
  getDatabase,
  libsqlUrl,
  mintDatabaseToken,
  previewDbName,
} from "./turso-api";

const pr = process.env.PR_NUMBER ?? process.argv[2];
if (!pr) throw new Error("PR_NUMBER is required (env or argv[2])");

const source = process.env.PREVIEW_SOURCE_DB ?? "loyalty-app";
const name = previewDbName(pr);

// Idempotent: clone prod into a fresh DB, or REUSE the existing one on
// re-push (pull_request: synchronize). We deliberately don't delete+recreate
// — deleting and immediately recreating the same name races Turso's
// provisioning (HTTP 404/401 for a few seconds). Migrations + masking re-run
// idempotently on reuse; the data is the PR's clone from when it was opened.
let db;
try {
  db = await createPreviewDatabase({ name, source });
} catch {
  db = await getDatabase(name);
}
const token = await mintDatabaseToken(name);
const url = libsqlUrl(db.Hostname);

// A freshly created (seeded) Turso DB takes a few seconds to start serving —
// querying too soon returns HTTP 404. Poll `select 1` until it answers so the
// downstream migrate/mask steps don't race the provisioning.
const { createClient } = await import("@libsql/client");
const probe = createClient({ url, authToken: token });
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    await probe.execute("select 1");
    break;
  } catch (err) {
    if (Date.now() > deadline) throw err;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  // Mask the token in logs, then expose machine-readable outputs.
  console.info(`::add-mask::${token}`);
  appendFileSync(
    ghOutput,
    `database_url=${url}\nauth_token=${token}\ndb_name=${name}\n`,
  );
  console.info(`✓ created ${name} (cloned from ${source})`);
} else {
  // Local: print everything so you can wire it up by hand.
  console.info(`✓ created ${name} (cloned from ${source})`);
  console.info(`DATABASE_URL=${url}`);
  console.info(`TURSO_AUTH_TOKEN=${token}`);
}
