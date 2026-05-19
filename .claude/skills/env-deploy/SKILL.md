---
name: env-deploy
description: Single source of truth for env vars (Infisical) and the reproducible dev/preview/prod deploy pipeline. Use when adding or rotating a secret, wiring an env into web/admin/jobs/partykit, setting up local dev, debugging "missing env" on a deploy, or onboarding a teammate to "where do secrets live and how do they reach each runtime".
---

# env-deploy — secrets + deploy runbook

**Infisical is the single source of truth for every secret**, across three
environments (`dev`, `preview`, `prod`). Nothing is hand-entered into Vercel,
Trigger.dev or PartyKit anymore — those receive their env *from* Infisical.

This skill grows one section per delivery phase:

| Phase | PR | Status |
| --- | --- | --- |
| 1 — Infisical source of truth | `chore(env): adopt Infisical` | merged (#44) |
| 2 — Dockerized local stack | `feat(dev): docker + sandbox` | **this PR** |
| 3 — Preview pipeline (Neon branch + sanitize + R2 folders) | `ci(preview): …` | planned |
| 4 — Prod pipeline (migrations + Trigger/PartyKit + Sentry + Slack) | `ci(prod): …` | planned |
| 5 — Hardening + check-env gate | `docs(env-deploy): …` | planned |

---

## Mental model

```
                ┌──────────────────────────────────────────┐
                │            Infisical project              │
                │            "loyalty-app"                  │
                │                                           │
                │  env: dev      env: preview   env: prod   │
                │  ──────────    ────────────   ─────────   │
                │  folders (exist in every environment):    │
                │    /shared   db, providers, Twilio, R2…   │
                │    /web      NEXT_PUBLIC_*, web ingest     │
                │    /admin    Better Auth, Google OAuth     │
                │    /jobs     Trigger.dev                   │
                │    /partykit realtime worker               │
                │    /mcp      Claude MCP + CI tokens        │
                └───────┬───────────┬───────────┬───────────┘
                        │           │           │
        local dev ──────┘           │           └────── CI (GHA)
   scripts/with-infisical.sh        │            infisical run (Fase 3/4)
   infisical run --recursive        │
                                    │
                          Infisical→Vercel native sync
                       (preview/prod, scoped per folder)
                     web project ← /shared+/web
                     admin project ← /shared+/admin
```

`/mcp` is **never** synced to a deploy target — those tokens are local
tooling + CI only (Better Stack MCP, Slack MCP, later Sentry CLI).

The full variable → folder → env matrix lives in **`.env.example`** (read
the header block). `.env.example` is the human-readable matrix; Infisical
holds the values.

---

## One-time setup (per machine / per teammate)

```bash
brew install infisical/get-cli/infisical     # CLI
infisical login                               # browser auth
infisical init                                # pick the "loyalty-app" project
                                              # → writes .infisical.json (commit it)
```

The Infisical project must have exactly three environment **slugs**:
`dev`, `preview`, `prod`. New Infisical projects ship `dev / staging / prod`
— rename `staging` → slug `preview` in the dashboard (Project → Settings →
Environments). The folder structure is created by the bootstrap script.

### Migrating an existing `.env`

```bash
bun run env:bootstrap                              # create folders in all 3 envs
bun run env:bootstrap -- --import .env --env dev   # push your old .env → dev folders
```

`scripts/infisical-bootstrap.sh` routes each variable to its folder using
the same matrix as `.env.example` (`folder_for()` in the script). Re-running
is safe (folders tolerate "exists", `secrets set` upserts). After importing,
adjust `preview`/`prod` values in the dashboard or via
`infisical secrets set KEY=VALUE --env=prod --path=/shared`.

---

## Daily local dev

Nothing changes in how you run things:

```bash
bun run dev          # web :3002 + admin :3003
bun run db:migrate
bun run jobs:dev
bun run partykit:dev
```

These are wrapped by `scripts/with-infisical.sh`, which:

- injects secrets via `infisical run --env=${INFISICAL_ENV:-dev} --recursive`
  when the CLI is installed **and** `.infisical.json` exists **and** you are
  not in CI;
- otherwise **falls back to running the command unchanged** (the old
  `.env` / direnv path). So the migration is non-breaking: before you run
  `infisical init`, everything works exactly as before.

Knobs:

- `INFISICAL_ENV=preview bun run dev` — run locally against the preview env.
- `NO_INFISICAL=1 bun run dev` — force the `.env`/direnv fallback.

Helper scripts:

- `bun run env:pull` — `infisical export` the current env as dotenv to stdout.
- `bun run env:check` — list every secret in the current env (all folders).

---

## Local dev in Docker (Fase 2)

`bun run dev:docker` brings up the whole stack offline **except Trigger.dev**
(its `dev` needs the cloud — keep running `bun run jobs:dev` on the host).

```
docker-compose.yml services:
  postgres     postgres:16, named volume, host port 5433
  neon-proxy   ghcr.io/timowilhelm/local-neon-http-proxy, host port 4444
  redis        redis:7 (only for CACHE_PROVIDER=redis; default is memory)
  partykit     bunx partykit dev :1999
  web          bunx next dev --webpack :3002
  admin        bunx next dev --turbopack :3003
```

No custom image — the official `oven/bun:1.2.10` runs everything. A
one-shot `deps` service runs `bun install --frozen-lockfile` into the
shared `node_modules` volume and exits; web/admin/partykit wait for it via
`depends_on: { condition: service_completed_successfully }`, so three
containers never race the same install. bun hoists the whole workspace to
the repo-root `node_modules`, so one install serves every app; services
differ only by `working_dir` + `command`. The repo is bind-mounted for HMR.

### The two-DATABASE_URL-consumers detail

`DATABASE_URL` stays a **plain Postgres URL**. Two consumers:

- **drizzle-kit** (`db:push`, `db:studio`) — direct `pg` TCP to Postgres
  (host `localhost:5433`).
- **`@neondatabase/serverless`** (`client.ts`, `migrate.ts`) — speaks
  Neon's HTTP protocol. `packages/db/src/neon-local.ts` reroutes its fetch
  to the `neon-proxy` sidecar **only when `NEON_HTTP_PROXY_URL` is set**
  (compose sets `http://neon-proxy:4444/sql`). Unset in preview/prod →
  zero behavior change, real Neon untouched. The driver is NOT swapped.

Run migrations against the Docker DB from the host:

```bash
bun run dev:docker            # in one terminal
bun run db:migrate:docker     # waits for :5433, migrates via the proxy
```

### Offline / secrets

`docker-compose.yml` ships dev-safe `${VAR:-default}` fallbacks
(providers=log, cache=memory, storage=local, a throwaway
`BETTER_AUTH_SECRET`/`REALTIME_AUTH_SECRET`), so `dev:docker` works with
**no network and no Infisical**. `dev:docker` is wrapped by
`scripts/with-infisical.sh`, so when you *are* logged in, real `dev`
secrets override the fallbacks via compose `${VAR}` substitution.

### Sandbox — validate ONE real third party

`bun run sandbox -- --<channel>=<provider>` does an authenticated
round-trip to a single provider to prove your sandbox credentials work
from this machine (it does **not** exercise the `@loyalty/*` send paths):

```bash
bun run sandbox -- --whatsapp=twilio   # GET Twilio account (SID+token)
bun run sandbox -- --sms=twilio
bun run sandbox -- --email=resend      # GET Resend domains
bun run sandbox -- --cache=upstash     # Upstash REST /ping
bun run sandbox -- --db=neon           # select 1 via the configured driver
```

Keep sandbox creds in Infisical (e.g. a `/sandbox` folder) and run
`infisical run --path=/sandbox -- bun run sandbox -- --email=resend`.

---

## MCP + CI tokens (`/mcp` folder)

`.mcp.json` resolves `${VAR}` from the **process** environment. Two ways to
feed it from Infisical:

```bash
# launch Claude Code with /mcp secrets injected
infisical run --env=dev --path=/mcp -- claude

# or export them into the shell (direnv .envrc still works as fallback)
infisical export --env=dev --path=/mcp --format=dotenv > .env.mcp
```

Source of truth for `BETTER_STACK_API_TOKEN`,
`BETTER_STACK_TELEMETRY_API_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`
(and later `SENTRY_AUTH_TOKEN`) is Infisical `dev:/mcp` (add `prod:/mcp`
only for tokens that genuinely differ in prod, e.g. a prod Sentry token).

---

## Vercel integration (deploy-time injection)

Configured **once in the Infisical dashboard** (Integrations → Vercel),
not in code:

- Infisical `preview` → each Vercel project's *Preview* env.
- Infisical `prod` → each Vercel project's *Production* env.
- Scope per project by folder:
  - `loyalty-app-web`   ← `/shared` + `/web`
  - `loyalty-app-admin` ← `/shared` + `/admin`
  - `loyalty-app-storybook` ← `/shared` (minimal)

After wiring, **stop hand-editing env in the Vercel dashboard** — it is
overwritten on the next sync. Change the value in Infisical instead.

`VERCEL_URL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL` are injected by
Vercel itself — never put them in Infisical.

## CI (`validate`) stays on stubs

`.github/workflows/ci.yml` keeps running with hardcoded stub env (it only
lints/knip/typechecks/tests — no secrets needed). The wrapper detects
`CI=true` and skips Infisical, so a committed `.infisical.json` does not
break CI. Preview/prod **deploy** workflows (Fases 3–4) are the only ones
that call `infisical run` with a service token.

---

## Rotating a secret

1. `infisical secrets set KEY=NEWVALUE --env=prod --path=/shared`
   (or the dashboard).
2. Vercel: redeploy (or wait for the next deploy) — the sync re-pushes.
3. Trigger.dev / PartyKit: re-run their deploy (Fase 4 automates this via
   `syncEnvVars` + `partykit env push`).
4. If it is an `/mcp` token: restart your Claude Code session.

Never commit a real value to `.env.example` — it is the matrix, not a vault.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `bun run dev` says "infisical: not logged in" | You created `.infisical.json` (opted in) but lack a token. `infisical login`, or `NO_INFISICAL=1 bun run dev` to bypass. |
| Local dev still uses `.env`, not Infisical | No `.infisical.json` yet. Run `infisical init`. |
| CI fails calling infisical | The wrapper should skip on `CI=true`. Check the workflow isn't calling `infisical run` directly without a service token. |
| A var is missing only on Vercel preview | It is not in `/shared` or the app's folder, or the Infisical→Vercel integration scope excludes that folder. |
| `invalid_client` on Google in preview | Preview uses a *different* Google OAuth client than prod (Fase 4). Confirm `GOOGLE_CLIENT_ID/SECRET` in Infisical `preview:/admin` and the redirect URI in that client. |
| Trigger deploy: "X is not set" | Fase 4 wires `syncEnvVars` from Infisical + lazy-init. Until then Trigger env is the dashboard. |
| `dev:docker`: web/admin crash on boot | `env.ts` throws if `DATABASE_URL`/`BETTER_AUTH_SECRET` missing. The compose fallbacks cover this; if you overrode them with empty values, unset the override. |
| `dev:docker`: db calls fail with a fetch/HTTP error | The neon-http driver isn't hitting the proxy. Confirm `NEON_HTTP_PROXY_URL` is set in the container and `neon-proxy` is healthy (`docker compose logs neon-proxy`). |
| `db:migrate:docker` hangs | Postgres not up yet — `wait-for-postgres.ts` polls `:5433`. Check `docker compose ps`. |

---

## Future phases (placeholders — do not implement here)

- **Fase 3**: `.github/workflows/preview.yml` — Neon branch from prod,
  `sanitize-for-preview.ts`, Trigger preview, R2 `pr-<n>/` prefix,
  per-branch override doc, Cloudflare/Hono API placeholder.
- **Fase 4**: `.github/workflows/deploy-prod.yml` — Neon snapshot +
  migrate, re-introduced lazy `@loyalty/db` + lazy jobs env +
  `syncEnvVars`, Trigger/PartyKit deploy, Sentry net-new, Google
  preview-vs-prod split, Slack deploy notify, `check-env.ts` gate.
- **Fase 5**: `check-env.ts` as a hard gate on preview + prod; secret
  rotation runbook across all surfaces.
