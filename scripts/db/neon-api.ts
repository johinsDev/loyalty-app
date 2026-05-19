// Tiny typed wrapper over the Neon API used by the preview pipeline.
// Docs: https://api-docs.neon.tech/reference/getting-started-with-neon-api
//
// Only the calls the pipeline needs. Every call throws with the HTTP
// body on non-2xx so CI logs are actionable.

import { appendFileSync } from "node:fs";

const BASE = "https://console.neon.tech/api/v2";

function apiKey(): string {
  const k = process.env.NEON_API_KEY;
  if (!k) throw new Error("NEON_API_KEY is not set");
  return k;
}

export async function neon<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Neon ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export function projectId(): string {
  const p = process.env.NEON_PROJECT_ID;
  if (!p) throw new Error("NEON_PROJECT_ID is not set");
  return p;
}

export interface NeonBranch {
  id: string;
  name: string;
  default?: boolean;
  parent_id?: string;
}

export interface NeonOperation {
  id: string;
  status: string; // "scheduling" | "running" | "finished" | "failed" | "cancelled"
}

/** The production branch id: explicit override, else the project default. */
export async function resolveParentBranchId(): Promise<string> {
  if (process.env.NEON_PARENT_BRANCH_ID) return process.env.NEON_PARENT_BRANCH_ID;
  const { branches } = await neon<{ branches: NeonBranch[] }>(
    "GET",
    `/projects/${projectId()}/branches`,
  );
  const def = branches.find((b) => b.default) ?? branches[0];
  if (!def) throw new Error("no branches found on the Neon project");
  return def.id;
}

export async function findBranchByName(name: string): Promise<NeonBranch | undefined> {
  const { branches } = await neon<{ branches: NeonBranch[] }>(
    "GET",
    `/projects/${projectId()}/branches`,
  );
  return branches.find((b) => b.name === name);
}

/** Poll operations until all finish; throw on the first failure. */
export async function waitForOperations(ops: NeonOperation[]): Promise<void> {
  const pending = ops.map((o) => o.id);
  const deadline = Date.now() + 15 * 60_000;
  while (pending.length && Date.now() < deadline) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const { operation } = await neon<{ operation: NeonOperation }>(
        "GET",
        `/projects/${projectId()}/operations/${pending[i]}`,
      );
      if (operation.status === "finished") {
        pending.splice(i, 1);
      } else if (operation.status === "failed" || operation.status === "cancelled") {
        throw new Error(`Neon operation ${operation.id} ${operation.status}`);
      }
    }
    if (pending.length) await Bun.sleep(5000);
  }
  if (pending.length) throw new Error(`Neon operations timed out: ${pending.join(", ")}`);
}

/** Pooled Postgres connection string for a branch. */
export async function getConnectionUri(branchId: string): Promise<string> {
  const db = process.env.NEON_DATABASE_NAME;
  const role = process.env.NEON_ROLE_NAME;
  if (!db || !role) {
    throw new Error("NEON_DATABASE_NAME and NEON_ROLE_NAME must be set");
  }
  const qs = new URLSearchParams({
    branch_id: branchId,
    database_name: db,
    role_name: role,
    pooled: "true",
  });
  const { uri } = await neon<{ uri: string }>(
    "GET",
    `/projects/${projectId()}/connection_uri?${qs}`,
  );
  return uri;
}

/** Append a key=value line to $GITHUB_OUTPUT when running in Actions. */
export function setOutput(key: string, value: string): void {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `${key}=${value}\n`);
  // Never echo connection strings to stdout.
  console.info(`set output ${key} (${value.length} chars)`);
}
