// Assign this PR's FE custom domains to the Vercel admin + web projects, scoped
// to the PR's head branch so Vercel routes the branch's preview deploy to them:
//   admin.pr-<N>.<zone> → admin project
//   app.pr-<N>.<zone>   → web project
// The matching DNS CNAMEs are created by scripts/cloudflare/deploy-preview-worker.ts;
// Vercel issues the TLS cert once the domain resolves. Idempotent (a re-add of an
// existing domain returns 409, treated as success). Counterpart:
// unalias-preview-domains.ts. Invoked from preview.yml behind PREVIEW_API_WORKER_ENABLED.
//
// Env: VERCEL_TOKEN, VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN (required),
//      VERCEL_TEAM_ID (optional), GIT_BRANCH, PR_NUMBER (required),
//      PREVIEW_ZONE (default t4diverclub.app).
const need = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
};

const token = need("VERCEL_TOKEN");
const gitBranch = need("GIT_BRANCH");
const pr = need("PR_NUMBER");
const zone = process.env.PREVIEW_ZONE ?? "t4diverclub.app";
const team = process.env.VERCEL_TEAM_ID;
const teamQs = team ? `?teamId=${team}` : "";

async function addDomain(projectId: string, name: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/domains${teamQs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, gitBranch }),
    },
  );
  if (res.ok) {
    console.info(`✓ ${name} → project ${projectId} (branch ${gitBranch})`);
    return;
  }
  // 409 = domain already assigned to the project → idempotent no-op.
  if (res.status === 409) {
    console.info(`→ ${name} already on ${projectId}`);
    return;
  }
  throw new Error(
    `add domain ${name} → ${projectId}: ${res.status} ${(await res.text()).slice(0, 300)}`,
  );
}

await addDomain(need("VERCEL_PROJECT_ID_ADMIN"), `admin.pr-${pr}.${zone}`);
await addDomain(need("VERCEL_PROJECT_ID_WEB"), `app.pr-${pr}.${zone}`);
