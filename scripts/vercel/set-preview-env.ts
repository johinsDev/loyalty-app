// Pin a branch-scoped env var on the Vercel web + admin projects so
// THIS PR's preview deploy gets its own value, leaving every other
// preview on the shared Infisical `preview` env.
//
// Two uses:
//   1. The pipeline pins this PR's Worker URL (preview.yml —
//      NEXT_PUBLIC_API_URL=https://api.pr-<n>.t4diverclub.app) + the Trigger
//      preview branch. The FE is a thin client, so it no longer pins the DB
//      connection — the Worker owns that (via wrangler).
//   2. Per-branch override to test a real third party on ONE preview,
//      e.g. real Resend on a branch:
//        GIT_BRANCH=fix/email \
//        ENV_KEY=EMAIL_PROVIDER ENV_VALUE=resend \
//          bun run scripts/vercel/set-preview-env.ts
//        (repeat for RESEND_API_KEY, EMAIL_FROM)
//
// Uses Vercel env upsert (`?upsert=true`) so re-runs just update.
// `gitBranch` scopes it to this PR's head branch only.
//
// Env in:
//   VERCEL_TOKEN                                   (required)
//   VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN (required)
//   VERCEL_TEAM_ID                                 (optional)
//   GIT_BRANCH                                     (required — PR head ref)
//   ENV_KEY                                        (required)
//   ENV_VALUE                                      (required)

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const token = need("VERCEL_TOKEN");
const gitBranch = need("GIT_BRANCH");
const envKey = need("ENV_KEY");
const envValue = need("ENV_VALUE");
const team = process.env.VERCEL_TEAM_ID;
const teamQs = team ? `&teamId=${team}` : "";

async function upsertEnv(projectId: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?upsert=true${teamQs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: envKey,
        value: envValue,
        type: "encrypted",
        target: ["preview"],
        gitBranch,
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vercel env upsert ${projectId} → ${res.status}: ${text.slice(0, 400)}`);
  }
  console.info(`✓ ${envKey} pinned on ${projectId} for branch ${gitBranch}`);
}

await upsertEnv(need("VERCEL_PROJECT_ID_WEB"));
await upsertEnv(need("VERCEL_PROJECT_ID_ADMIN"));
