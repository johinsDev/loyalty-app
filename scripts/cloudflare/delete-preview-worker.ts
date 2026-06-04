// Tear down the per-PR preview API Worker (counterpart of
// deploy-preview-worker.ts). Removes the custom domain binding (+ its DNS
// record) and deletes the Worker script via the Cloudflare API — no wrangler
// confirmation prompts. Fully idempotent: a missing Worker / domain is a no-op,
// so PR-close cleanup never fails on an already-gone resource.
//
// Env:
//   PR_NUMBER              (required)
//   PREVIEW_ZONE           parent zone (default t4diverclub.app)
//   CLOUDFLARE_ACCOUNT_ID  (required)
//   CLOUDFLARE_API_TOKEN   (required)
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

const workerName = `loyalty-api-pr-${pr}`;
const apiHost = `api.pr-${pr}.${zone}`;
const adminHost = `admin.pr-${pr}.${zone}`;
const webHost = `app.pr-${pr}.${zone}`;
const v4 = "https://api.cloudflare.com/client/v4";
const acct = `/accounts/${accountId}`;

// `path` is the full v4 path (e.g. `/accounts/.../workers/...` or `/zones/...`).
async function cf(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${v4}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

// 1) Remove the Workers custom domain (also drops the api.pr-<N> DNS record CF
//    created for it).
const listRes = await cf(
  `${acct}/workers/domains?hostname=${encodeURIComponent(apiHost)}`,
);
if (listRes.ok) {
  const body = (await listRes.json()) as { result?: { id: string }[] };
  for (const domain of body.result ?? []) {
    const del = await cf(`${acct}/workers/domains/${domain.id}`, {
      method: "DELETE",
    });
    console.info(
      `→ custom domain ${apiHost} (${domain.id}) → ${del.ok ? "removed" : del.status}`,
    );
  }
} else {
  console.info(`→ list domains for ${apiHost} → ${listRes.status} (skipping)`);
}

// 2) Delete the Worker script (force=true detaches any remaining bindings).
const scriptRes = await cf(`${acct}/workers/scripts/${workerName}?force=true`, {
  method: "DELETE",
});
if (scriptRes.ok || scriptRes.status === 404) {
  console.info(`✓ Worker ${workerName} ${scriptRes.status === 404 ? "already gone" : "deleted"}`);
} else {
  throw new Error(`delete ${workerName} → ${scriptRes.status}: ${(await scriptRes.text()).slice(0, 300)}`);
}

// 3) Remove the FE CNAMEs (admin.pr-<N> / app.pr-<N>) created by the deploy
//    script. Resolve the zone, look each up by name, delete if present.
const zoneRes = await cf(`/zones?name=${encodeURIComponent(zone)}`);
const zoneBody = (await zoneRes.json()) as { result?: { id: string }[] };
const zoneId = zoneBody.result?.[0]?.id;
if (zoneId) {
  for (const host of [adminHost, webHost]) {
    const recRes = await cf(
      `/zones/${zoneId}/dns_records?name=${encodeURIComponent(host)}`,
    );
    const recBody = (await recRes.json()) as { result?: { id: string }[] };
    for (const rec of recBody.result ?? []) {
      const del = await cf(`/zones/${zoneId}/dns_records/${rec.id}`, {
        method: "DELETE",
      });
      console.info(`→ DNS ${host} (${rec.id}) → ${del.ok ? "removed" : del.status}`);
    }
  }
} else {
  console.info(`→ zone ${zone} not resolved — skipping FE DNS cleanup`);
}
