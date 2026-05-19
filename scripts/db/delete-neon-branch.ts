// Delete the preview/pr-<n> Neon branch when a PR closes. Idempotent:
// a missing branch is a no-op (the run still succeeds).
//
// Env in: NEON_API_KEY, NEON_PROJECT_ID, PR_NUMBER

import {
  findBranchByName,
  neon,
  type NeonOperation,
  projectId,
  waitForOperations,
} from "./neon-api";

const prNumber = process.env.PR_NUMBER;
if (!prNumber) throw new Error("PR_NUMBER is not set");
const branchName = `preview/pr-${prNumber}`;

const branch = await findBranchByName(branchName);
if (!branch) {
  console.info(`branch ${branchName} not found — nothing to delete`);
  process.exit(0);
}

console.info(`deleting branch ${branchName} (${branch.id})`);
const { operations } = await neon<{ operations: NeonOperation[] }>(
  "DELETE",
  `/projects/${projectId()}/branches/${branch.id}`,
);
await waitForOperations(operations ?? []);
console.info("deleted");
