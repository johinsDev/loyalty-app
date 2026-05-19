// Pin a branch-scoped `DATABASE_URL` on the Vercel web + admin projects
// so THIS PR's preview deploy uses its own anonymized Neon branch
// instead of the shared Infisical preview value.
//
// Uses Vercel's env upsert (`?upsert=true`) so re-runs on `synchronize`
// just update the value. `gitBranch` scopes it to this PR's head branch
// only — other previews are unaffected.
//
// Env in:
//   VERCEL_TOKEN                              (required)
//   VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN (required)
//   VERCEL_TEAM_ID                            (optional, for team scope)
//   PREVIEW_DATABASE_URL                      (required — the branch URI)
//   GIT_BRANCH                                (required — PR head ref)

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const token = need("VERCEL_TOKEN");
const dbUrl = need("PREVIEW_DATABASE_URL");
const gitBranch = need("GIT_BRANCH");
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
        key: "DATABASE_URL",
        value: dbUrl,
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
  console.info(`✓ DATABASE_URL pinned on ${projectId} for branch ${gitBranch}`);
}

await upsertEnv(need("VERCEL_PROJECT_ID_WEB"));
await upsertEnv(need("VERCEL_PROJECT_ID_ADMIN"));
