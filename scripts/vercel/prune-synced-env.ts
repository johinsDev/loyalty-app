// Prune backend secrets that the Infisical→Vercel sync left on the FE projects.
// After moving backend-only secrets out of Infisical /shared into /api (which is
// NOT synced to Vercel), the already-synced copies stay orphaned on the web/admin
// Vercel projects. This deletes exactly the moved names (never NEXT_PUBLIC_*, the
// per-PR pins, or Sentry/log config).
//
//   Dry run (default): VERCEL_TOKEN=… VERCEL_TEAM_ID=… WEB=prj_… ADMIN=prj_… \
//     bun run scripts/vercel/prune-synced-env.ts
//   Apply:  add APPLY=1
import process from "node:process";

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const token = need("VERCEL_TOKEN");
const teamId = need("VERCEL_TEAM_ID");
const apply = process.env.APPLY === "1";
const projects: Record<string, string> = {
  web: need("WEB"),
  admin: need("ADMIN"),
};

// Exactly the backend names moved out of /shared → /api. NEVER includes
// NEXT_PUBLIC_*, LOG_*, Sentry, BETTER_AUTH_URL, or the per-PR pins
// (NEXT_PUBLIC_API_URL, TRIGGER_PREVIEW_BRANCH).
const PRUNE = new Set([
  "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_PROVIDER",
  "STORAGE_PROVIDER", "R2_ACCOUNT_ID", "R2_BUCKET",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_URL",
  "WHATSAPP_PROVIDER", "SMS_PROVIDER", "PUSH_PROVIDER",
  "CACHE_PROVIDER", "CACHE_DEFAULT_TTL", "RATE_LIMIT_PROVIDER",
  "ANALYTICS_PROVIDER", "FEATURE_FLAGS_PROVIDER",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET", "REALTIME_AUTH_SECRET",
  "TRIGGER_SECRET_KEY", "TRIGGER_PROJECT_ID",
  "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "PARTYKIT_HOST", "PARTYKIT_PROJECT",
  "ADMIN_PREVIEW_EMAIL", "ADMIN_PREVIEW_PASSWORD",
  "LOYALTY_ORG_ID",
]);

const api = (path: string, init?: RequestInit) =>
  fetch(`https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${teamId}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });

let total = 0;
for (const [label, projectId] of Object.entries(projects)) {
  const res = await api(`/v9/projects/${projectId}/env`);
  if (!res.ok) throw new Error(`list ${label} env failed: ${res.status} ${await res.text()}`);
  const { envs } = (await res.json()) as {
    envs: { id: string; key: string; target: string[] }[];
  };
  const hits = envs.filter((e) => PRUNE.has(e.key));
  console.info(`\n=== ${label} (${projectId}) — ${hits.length} to prune ===`);
  for (const e of hits) {
    const tgt = (e.target ?? []).join(",");
    if (apply) {
      const del = await api(`/v10/projects/${projectId}/env/${e.id}`, { method: "DELETE" });
      console.info(`  ${del.ok ? "🗑  deleted" : `❌ ${del.status}`}  ${e.key} [${tgt}]`);
    } else {
      console.info(`  would delete  ${e.key} [${tgt}]`);
    }
    total += 1;
  }
}
console.info(`\n${apply ? "Deleted" : "Would delete"} ${total} env var(s) across web+admin. ${apply ? "" : "Re-run with APPLY=1 to delete."}`);
