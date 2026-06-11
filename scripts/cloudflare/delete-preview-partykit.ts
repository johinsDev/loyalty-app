// PR-close cleanup for the per-PR PartyKit preview (deploy-preview-partykit.ts).
// Mirrors scripts/cloudflare/delete-preview-worker.ts: drop the worker's custom
// domain (which removes the DNS record PartyKit created) then delete the worker
// script. Idempotent — a 404 is treated as already-gone.
//
//   PR_NUMBER=7 infisical run --env=prod --path=/ci -- \
//     bun run scripts/cloudflare/delete-preview-partykit.ts
import process from "node:process";

const need = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
};

const pr = need("PR_NUMBER");
const zone = process.env.PREVIEW_ZONE ?? "t4diverclub.app";
const accountId = need("CLOUDFLARE_ACCOUNT_ID");
const token = need("CLOUDFLARE_API_TOKEN");

const workerName = `loyalty-realtime-pr-${pr}`;
const host = `partykit.pr-${pr}.${zone}`;

const base = "https://api.cloudflare.com/client/v4";
const acct = `${base}/accounts/${accountId}`;
const cf = (path: string, init?: RequestInit) =>
  fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });

// 1. Remove the Worker custom domain (also drops the DNS record PartyKit created).
const listRes = await cf(`${acct}/workers/domains?hostname=${encodeURIComponent(host)}`);
if (listRes.ok) {
  const body = (await listRes.json()) as { result?: { id: string }[] };
  for (const domain of body.result ?? []) {
    const del = await cf(`${acct}/workers/domains/${domain.id}`, { method: "DELETE" });
    console.info(`  custom domain ${host} → ${del.status}`);
  }
}

// 2. Delete the Worker script.
const scriptRes = await cf(`${acct}/workers/scripts/${workerName}?force=true`, {
  method: "DELETE",
});
if (scriptRes.ok || scriptRes.status === 404) {
  console.info(
    `✓ party ${workerName} ${scriptRes.status === 404 ? "already gone" : "deleted"}`,
  );
} else {
  console.warn(`! party ${workerName} delete → ${scriptRes.status}`);
}
