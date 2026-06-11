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

// Trigger.dev wiring (optional). When the preview env provides a TRIGGER secret,
// route the Worker's phone-OTP enqueue (auth `sendOtp`) to THIS PR's Trigger
// preview branch: the secret key picks the preview env, TRIGGER_PREVIEW_BRANCH
// the branch. Omitted → phone-OTP just isn't wired (admin email/password still
// works). TRIGGER_PROJECT_ID + branch are non-secret → `[vars]`.
const gitBranch = process.env.GIT_BRANCH;
const triggerSecret = process.env.TRIGGER_SECRET_KEY;
const triggerProjectId = process.env.TRIGGER_PROJECT_ID;
const triggerVars = [
  triggerProjectId ? `TRIGGER_PROJECT_ID = "${triggerProjectId}"` : "",
  triggerSecret && gitBranch ? `TRIGGER_PREVIEW_BRANCH = "${gitBranch}"` : "",
]
  .filter(Boolean)
  .join("\n");

// Lean-Worker provider config forwarded from the preview base env
// (staging/shared, injected by the deploy step). The Workers-safe providers:
// realtime (signed fetch to PartyKit — needs REALTIME_AUTH_SECRET, or
// realtime.issueTicket 500s), Better Stack log (HTTP), R2 storage (aws4fetch
// driver). Rate-limit deliberately stays on the in-memory provider in previews
// to save Upstash quota (previews are ephemeral) — prod gets Upstash (now
// Workers-safe via the static provider). PostHog (analytics + flags) runs on the
// `fetch` driver (REST /decide + /capture), so the public key IS forwarded —
// the Worker evaluates flags server-side against the real project.
const realtimeSecret = process.env.REALTIME_AUTH_SECRET;
const betterStackToken =
  process.env.BETTER_STACK_SOURCE_TOKEN_API ?? process.env.BETTER_STACK_SOURCE_TOKEN;
const betterStackHost =
  process.env.BETTER_STACK_INGESTING_HOST_API ??
  process.env.BETTER_STACK_INGESTING_HOST;
const providerVars = [
  process.env.PARTYKIT_HOST ? `PARTYKIT_HOST = "${process.env.PARTYKIT_HOST}"` : "",
  process.env.PARTYKIT_PROJECT
    ? `PARTYKIT_PROJECT = "${process.env.PARTYKIT_PROJECT}"`
    : "",
  // Match the FE/jobs per-PR room prefix so clients subscribe to the same room.
  `REALTIME_ROOM_PREFIX = "pr-${pr}-"`,
  betterStackHost ? `BETTER_STACK_INGESTING_HOST_API = "${betterStackHost}"` : "",
  // R2 storage (aws4fetch driver) — account/bucket/public-url are non-secret;
  // the access key + secret go through `secret put` below. Per-PR key prefix so
  // uploads land in their own folder (purged on PR close, like the FE).
  process.env.R2_ACCOUNT_ID
    ? `R2_ACCOUNT_ID = "${process.env.R2_ACCOUNT_ID}"`
    : "",
  process.env.R2_BUCKET ? `R2_BUCKET = "${process.env.R2_BUCKET}"` : "",
  process.env.R2_PUBLIC_URL
    ? `R2_PUBLIC_URL = "${process.env.R2_PUBLIC_URL}"`
    : "",
  `STORAGE_KEY_PREFIX = "pr-${pr}/"`,
  // PostHog (analytics + flags via the Workers-safe `fetch` driver). The phc_
  // key is public/embeddable, so it's a `[var]`, not a secret. Without it the
  // Worker falls to the null provider (flags return caller defaults).
  process.env.NEXT_PUBLIC_POSTHOG_KEY
    ? `NEXT_PUBLIC_POSTHOG_KEY = "${process.env.NEXT_PUBLIC_POSTHOG_KEY}"`
    : "",
  process.env.NEXT_PUBLIC_POSTHOG_HOST
    ? `NEXT_PUBLIC_POSTHOG_HOST = "${process.env.NEXT_PUBLIC_POSTHOG_HOST}"`
    : "",
]
  .filter(Boolean)
  .join("\n");

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
${triggerVars}
${providerVars}
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

// `wrangler secret put` flakes intermittently (transient API errors) — a single
// failure used to abort the deploy mid-loop, leaving the Worker half-configured
// and the FE DNS uncreated (the steps below never ran). Retry a few times.
function secretPut(key: string, value: string, attempts = 3): void {
  for (let i = 1; i <= attempts; i++) {
    try {
      wrangler(["secret", "put", key], value);
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`  secret put ${key} failed (${i}/${attempts}), retrying…`);
      spawnSync("sleep", ["3"]);
    }
  }
}

console.info(`→ Deploying ${name} → https://${apiHost}`);
wrangler(["deploy"]);

const secrets: Record<string, string> = {
  DATABASE_URL: need("PREVIEW_DATABASE_URL"),
  TURSO_AUTH_TOKEN: need("PREVIEW_AUTH_TOKEN"),
  BETTER_AUTH_SECRET: need("BETTER_AUTH_SECRET"),
  // Lets the Worker's auth `sendOtp` enqueue to Trigger.dev (web phone-OTP).
  ...(triggerSecret && { TRIGGER_SECRET_KEY: triggerSecret }),
  // Realtime (signed PartyKit tickets) + Better Stack log — the Workers-safe
  // providers. Without REALTIME_AUTH_SECRET, realtime.issueTicket 500s.
  ...(realtimeSecret && { REALTIME_AUTH_SECRET: realtimeSecret }),
  ...(betterStackToken && { BETTER_STACK_SOURCE_TOKEN_API: betterStackToken }),
  // R2 storage (aws4fetch driver) — the S3 access key + secret. The Worker
  // builds the R2 disk only when all of ACCOUNT_ID/ACCESS_KEY_ID/SECRET/BUCKET
  // are present (account/bucket are [vars] above).
  ...(process.env.R2_ACCESS_KEY_ID && {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  }),
  ...(process.env.R2_SECRET_ACCESS_KEY && {
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  }),
};
for (const [key, value] of Object.entries(secrets)) {
  console.info(`→ secret put ${key}`);
  secretPut(key, value);
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
