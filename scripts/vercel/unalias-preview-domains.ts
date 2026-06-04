// Remove this PR's FE custom domains from the Vercel admin + web projects
// (counterpart of alias-preview-domains.ts). Idempotent: a 404 (already gone) is
// success, so PR-close cleanup never fails. Invoked from preview-cleanup.yml.
//
// Env: VERCEL_TOKEN, VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN (required),
//      VERCEL_TEAM_ID (optional), PR_NUMBER (required),
//      PREVIEW_ZONE (default t4diverclub.app).
const need = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
};

const token = need("VERCEL_TOKEN");
const pr = need("PR_NUMBER");
const zone = process.env.PREVIEW_ZONE ?? "t4diverclub.app";
const team = process.env.VERCEL_TEAM_ID;
const teamQs = team ? `?teamId=${team}` : "";

async function removeDomain(projectId: string, name: string): Promise<void> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/domains/${name}${teamQs}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (res.ok || res.status === 404) {
    console.info(`✓ ${name} removed from ${projectId}${res.status === 404 ? " (already gone)" : ""}`);
    return;
  }
  throw new Error(
    `remove domain ${name} ← ${projectId}: ${res.status} ${(await res.text()).slice(0, 300)}`,
  );
}

await removeDomain(need("VERCEL_PROJECT_ID_ADMIN"), `admin.pr-${pr}.${zone}`);
await removeDomain(need("VERCEL_PROJECT_ID_WEB"), `app.pr-${pr}.${zone}`);
