// Pin a branch-scoped env var on the Vercel web + admin projects so
// THIS PR's preview deploy gets its own value, leaving every other
// preview on the shared Infisical `preview` env.
//
// Two uses:
//   1. The pipeline pins the per-PR Turso preview DB connection
//      (preview.yml — DATABASE_URL + TURSO_AUTH_TOKEN).
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
//   ENV_KEY    (default "DATABASE_URL")
//   ENV_VALUE  (default $PREVIEW_DATABASE_URL — back-compat with the pipeline)

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const token = need("VERCEL_TOKEN");
const gitBranch = need("GIT_BRANCH");
const envKey = process.env.ENV_KEY ?? "DATABASE_URL";
const envValue =
  process.env.ENV_VALUE ??
  process.env.PREVIEW_DATABASE_URL ??
  (() => {
    throw new Error("ENV_VALUE (or PREVIEW_DATABASE_URL) is not set");
  })();
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
