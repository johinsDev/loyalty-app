// Remove EVERY branch-scoped env var from the Vercel web + admin
// projects when a PR closes — the pinned DATABASE_URL and any per-branch
// overrides (e.g. a branch that opted into real Resend). A closed PR
// must not leave branch-scoped vars behind. Idempotent: no matches → no-op.
//
// Env in: VERCEL_TOKEN, VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN,
//         VERCEL_TEAM_ID (optional), GIT_BRANCH

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const token = need("VERCEL_TOKEN");
const gitBranch = need("GIT_BRANCH");
const team = process.env.VERCEL_TEAM_ID;

interface VercelEnv {
  id: string;
  key: string;
  gitBranch?: string | null;
  target?: string[];
}

async function vercel(method: string, path: string): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `https://api.vercel.com${path}${team ? `${sep}teamId=${team}` : ""}`,
    { method, headers: { Authorization: `Bearer ${token}` } },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Vercel ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function purge(projectId: string): Promise<void> {
  const { envs } = (await vercel(
    "GET",
    `/v9/projects/${projectId}/env`,
  )) as { envs: VercelEnv[] };
  const matches = envs.filter((e) => e.gitBranch === gitBranch);
  for (const e of matches) {
    await vercel("DELETE", `/v9/projects/${projectId}/env/${e.id}`);
    console.info(`✓ removed ${e.key} (${e.id}) from ${projectId}`);
  }
  if (!matches.length) {
    console.info(`no branch-scoped env on ${projectId} for ${gitBranch} — skip`);
  }
}

await purge(need("VERCEL_PROJECT_ID_WEB"));
await purge(need("VERCEL_PROJECT_ID_ADMIN"));
