// Per-PR PartyKit (realtime) preview deploy — a dedicated party per PR, mirroring
// the per-PR API Worker (scripts/cloudflare/deploy-preview-worker.ts). Off by
// default; the preview pipeline only runs this when PREVIEW_PARTYKIT_ENABLED is
// set. Without it, all previews share `partykit-staging.t4diverclub.app` and
// isolate by REALTIME_ROOM_PREFIX (the cheaper default).
//
// PartyKit cloud-prem: `partykit deploy` reads CLOUDFLARE_ACCOUNT_ID +
// CLOUDFLARE_API_TOKEN from the env and provisions the worker + custom domain
// (DNS + edge cert) itself — the cert takes ~2 min on first deploy (Total TLS on
// the zone makes that reliable). `--name` gives this PR its own worker so it
// never clobbers staging/prod (1 worker per name).
//
//   PR_NUMBER=7 infisical run --env=prod --path=/ci -- \
//     infisical run --env=staging --path=/api -- \
//     bun run scripts/cloudflare/deploy-preview-partykit.ts
import { execFileSync } from "node:child_process";
import process from "node:process";

const need = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} is not set — run under the preview pipeline's infisical chain.`,
    );
  }
  return value;
};

const pr = need("PR_NUMBER");
const zone = process.env.PREVIEW_ZONE ?? "t4diverclub.app";
need("CLOUDFLARE_ACCOUNT_ID"); // consumed by partykit (cloud-prem) from the env
need("CLOUDFLARE_API_TOKEN");
const secret = need("REALTIME_AUTH_SECRET");

const name = `loyalty-realtime-pr-${pr}`;
const host = `partykit.pr-${pr}.${zone}`;

console.info(`→ Deploying ${name} → https://${host}`);
execFileSync(
  "bunx",
  [
    "partykit",
    "deploy",
    "--name",
    name,
    "--domain",
    host,
    "--var",
    `REALTIME_AUTH_SECRET=${secret}`,
  ],
  { cwd: "partykit", stdio: "inherit" },
);

console.info(`✓ preview party ${name} deployed → https://${host}`);
console.info(
  `  (custom-domain cert can take ~2 min; verify: curl https://${host}/party/main)`,
);
