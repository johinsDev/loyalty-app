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
  libsqlUrl,
  mintDatabaseToken,
  previewDbName,
} from "./turso-api";

const pr = process.env.PR_NUMBER ?? process.argv[2];
if (!pr) throw new Error("PR_NUMBER is required (env or argv[2])");

const source = process.env.PREVIEW_SOURCE_DB ?? "loyalty-app";
const name = previewDbName(pr);

const db = await createPreviewDatabase({ name, source });
const token = await mintDatabaseToken(name);
const url = libsqlUrl(db.Hostname);

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
