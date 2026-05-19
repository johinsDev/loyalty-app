// Create an ANONYMIZED Neon branch from production for a PR preview.
//
// Neon's native PostgreSQL Anonymizer feature: one API call creates the
// branch from the parent AND applies static masking rules, preserving
// referential integrity. Masking is static (permanent on the branch),
// so on every push we recreate the branch to get fresh prod data —
// exactly Neon's recommended workflow.
//
// Env in:
//   NEON_API_KEY, NEON_PROJECT_ID            (required)
//   NEON_DATABASE_NAME, NEON_ROLE_NAME       (required — for the conn URI)
//   PR_NUMBER                                (required — names the branch)
//   NEON_PARENT_BRANCH_ID                    (optional — else project default)
// Out: writes `branch_id` and `database_url` to $GITHUB_OUTPUT.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findBranchByName,
  getConnectionUri,
  neon,
  type NeonBranch,
  type NeonOperation,
  projectId,
  resolveParentBranchId,
  setOutput,
  waitForOperations,
} from "./neon-api";

const prNumber = process.env.PR_NUMBER;
if (!prNumber) throw new Error("PR_NUMBER is not set");
const branchName = `preview/pr-${prNumber}`;

const dbName = process.env.NEON_DATABASE_NAME;
if (!dbName) throw new Error("NEON_DATABASE_NAME is not set");

const here = dirname(fileURLToPath(import.meta.url));
const cfg = (await Bun.file(
  resolve(here, "../../config/neon-masking-rules.json"),
).json()) as { rules: { schema: string; table: string; column: string; function: string }[] };

const masking_rules = cfg.rules.map((r) => ({
  database_name: dbName,
  schema_name: r.schema,
  table_name: r.table,
  column_name: r.column,
  masking_function: r.function,
}));

// Fresh prod data every run: drop a stale same-named branch first.
const existing = await findBranchByName(branchName);
if (existing) {
  console.info(`removing stale branch ${branchName} (${existing.id})`);
  const { operations } = await neon<{ operations: NeonOperation[] }>(
    "DELETE",
    `/projects/${projectId()}/branches/${existing.id}`,
  );
  await waitForOperations(operations ?? []);
}

const parentId = await resolveParentBranchId();
console.info(`creating anonymized branch ${branchName} from ${parentId}`);

const created = await neon<{
  branch: NeonBranch;
  operations: NeonOperation[];
}>("POST", `/projects/${projectId()}/branch_anonymized`, {
  branch: { name: branchName, parent_id: parentId },
  endpoints: [{ type: "read_write" }],
  masking_rules,
  start_anonymization: true,
});

await waitForOperations(created.operations ?? []);
console.info(`branch ${created.branch.id} ready, anonymization applied`);

const uri = await getConnectionUri(created.branch.id);

setOutput("branch_id", created.branch.id);
setOutput("database_url", uri);
