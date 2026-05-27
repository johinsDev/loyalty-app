// Destroy a per-PR preview database. Called on `pull_request: closed`.
// Idempotent — a missing database (already deleted) is treated as success.
//
// Usage:
//   PR_NUMBER=123 bun run scripts/db/delete-preview-db.ts

import { deleteDatabase, previewDbName } from "./turso-api";

const pr = process.env.PR_NUMBER ?? process.argv[2];
if (!pr) throw new Error("PR_NUMBER is required (env or argv[2])");

const name = previewDbName(pr);

try {
  await deleteDatabase(name);
  console.info(`✓ destroyed ${name}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("404")) {
    console.info(`(skip) ${name} does not exist — nothing to destroy`);
  } else {
    throw err;
  }
}
