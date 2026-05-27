// After the per-PR DATABASE_URL/TURSO_AUTH_TOKEN are pinned, trigger a fresh
// Vercel preview build for web + admin from the PR's branch HEAD. The push
// auto-deploy races the pin and is skipped by the `ignoreCommand` in each
// app's vercel.json (preview build is skipped while DATABASE_URL is absent),
// so this Action-triggered deploy is the one that actually builds — now with
// the env present.
//
// Env in:
//   VERCEL_TOKEN, VERCEL_TEAM_ID                   (required)
//   VERCEL_PROJECT_ID_WEB, VERCEL_PROJECT_ID_ADMIN (required)
//   GIT_BRANCH                                     (required — PR head ref)
//   VERCEL_GIT_REPO_ID                             (GitHub repo numeric id)

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

const token = need("VERCEL_TOKEN");
const team = need("VERCEL_TEAM_ID");
const branch = need("GIT_BRANCH");
const repoId = Number(process.env.VERCEL_GIT_REPO_ID ?? "1232152228");

const projects = [
  { name: "loyalty-app-web", id: need("VERCEL_PROJECT_ID_WEB") },
  { name: "loyalty-app-admin", id: need("VERCEL_PROJECT_ID_ADMIN") },
];

for (const project of projects) {
  const res = await fetch(
    `https://api.vercel.com/v13/deployments?teamId=${team}&forceNew=1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: project.name,
        project: project.id,
        target: "preview",
        gitSource: { type: "github", repoId, ref: branch },
      }),
    },
  );
  const body = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(
      `Vercel deploy ${project.name} → ${res.status}: ${body.error?.message ?? JSON.stringify(body).slice(0, 300)}`,
    );
  }
  console.info(`✓ triggered preview build for ${project.name}: https://${body.url}`);
}
