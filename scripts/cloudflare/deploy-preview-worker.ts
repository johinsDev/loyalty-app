// Deploy a per-PR preview API Worker on Cloudflare, mirroring the per-PR Turso
// pattern (scripts/db/*). The Worker is named `loyalty-api-pr-<N>` and bound to
// the custom domain `api.pr-<N>.<zone>` (wrangler provisions the DNS record +
// edge cert), pointed at THIS PR's masked DB clone. Auth issues a cookie scoped
// to `.pr-<N>.<zone>` so it reaches the sibling FE subdomains but not prod /
// other PRs. Invoked only from preview.yml, gated by PREVIEW_API_WORKER_ENABLED.
//
// Env:
//   PR_NUMBER              (required)
//   PREVIEW_ZONE           parent zone (default t4diverclub.app)
//   CLOUDFLARE_ACCOUNT_ID  (required)
//   CLOUDFLARE_API_TOKEN   (required; read by wrangler — Workers + zone DNS/cert edit)
//   PREVIEW_DATABASE_URL   per-PR Turso URL   (required → secret)
//   PREVIEW_AUTH_TOKEN     per-PR Turso token (required → secret)
//   BETTER_AUTH_SECRET     staging value, MUST match the seeded preview admin (required → secret)
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const need = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
};

const pr = need("PR_NUMBER");
const zone = process.env.PREVIEW_ZONE ?? "t4diverclub.app";
const accountId = need("CLOUDFLARE_ACCOUNT_ID");
need("CLOUDFLARE_API_TOKEN"); // consumed by wrangler from the environment

const name = `loyalty-api-pr-${pr}`;
const apiHost = `api.pr-${pr}.${zone}`;
const adminHost = `admin.pr-${pr}.${zone}`;
const webHost = `app.pr-${pr}.${zone}`;
const cookieDomain = `.pr-${pr}.${zone}`;

const repoRoot = process.cwd();
const apiDir = join(repoRoot, "apps", "api");
const configPath = join(apiDir, "wrangler.preview.toml");
const wranglerBin = join(repoRoot, "node_modules", ".bin", "wrangler");

// Per-PR wrangler config. Non-secret config (auth URLs, cookie domain, the
// email/password flag for the seeded admin) is `[vars]`; only true secrets go
// through `wrangler secret put` below. Mirrors apps/api/wrangler.toml settings.
const config = `# generated per-PR by scripts/cloudflare/deploy-preview-worker.ts — DO NOT COMMIT
name = "${name}"
main = "src/index.ts"
account_id = "${accountId}"
compatibility_date = "2025-05-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = false

[observability]
enabled = true

[[routes]]
pattern = "${apiHost}"
custom_domain = true

[vars]
BETTER_AUTH_URL = "https://${apiHost}"
BETTER_AUTH_TRUSTED_ORIGINS = "https://${adminHost},https://${webHost}"
AUTH_COOKIE_DOMAIN = "${cookieDomain}"
AUTH_PASSWORD_ENABLED = "true"
`;
writeFileSync(configPath, config);

function wrangler(args: string[], input?: string): void {
  const res = spawnSync(wranglerBin, [...args, "-c", configPath], {
    cwd: apiDir,
    env: process.env,
    input,
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    throw new Error(`wrangler ${args.join(" ")} exited ${res.status ?? res.signal}`);
  }
}

console.info(`→ Deploying ${name} → https://${apiHost}`);
wrangler(["deploy"]);

const secrets: Record<string, string> = {
  DATABASE_URL: need("PREVIEW_DATABASE_URL"),
  TURSO_AUTH_TOKEN: need("PREVIEW_AUTH_TOKEN"),
  BETTER_AUTH_SECRET: need("BETTER_AUTH_SECRET"),
};
for (const [key, value] of Object.entries(secrets)) {
  console.info(`→ secret put ${key}`);
  wrangler(["secret", "put", key], value);
}

// FE DNS: the worker custom domain already created api.pr-<N>; the admin./app.
// FE subdomains need their own DNS-only CNAMEs → Vercel (which terminates TLS +
// issues the cert once the matching project domain is added by the Vercel alias
// script). Resolve the zone id from PREVIEW_ZONE so it isn't a separate prereq.
const cfBase = "https://api.cloudflare.com/client/v4";
const cfHeaders = {
  Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
  "Content-Type": "application/json",
};

const zoneRes = await fetch(
  `${cfBase}/zones?name=${encodeURIComponent(zone)}`,
  { headers: cfHeaders },
);
const zoneBody = (await zoneRes.json()) as { result?: { id: string }[] };
const zoneId = zoneBody.result?.[0]?.id;
if (!zoneId) throw new Error(`could not resolve zone id for ${zone}`);

// Idempotent CNAME upsert (create, or skip if Cloudflare reports it exists).
async function upsertCname(host: string): Promise<void> {
  const res = await fetch(`${cfBase}/zones/${zoneId}/dns_records`, {
    method: "POST",
    headers: cfHeaders,
    body: JSON.stringify({
      type: "CNAME",
      name: host,
      content: "cname.vercel-dns.com",
      proxied: false,
      ttl: 60,
    }),
  });
  if (res.ok) {
    console.info(`→ DNS ${host} → cname.vercel-dns.com`);
    return;
  }
  const body = (await res.json()) as { errors?: { code: number }[] };
  // 81053/81057 = record already exists → idempotent no-op.
  if (body.errors?.some((e) => e.code === 81053 || e.code === 81057)) {
    console.info(`→ DNS ${host} already present`);
    return;
  }
  throw new Error(`DNS ${host} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
}

await upsertCname(adminHost);
await upsertCname(webHost);

console.info(`✓ Preview API Worker live at https://${apiHost}`);
console.info(`  FE DNS ready for https://${adminHost} + https://${webHost}`);
