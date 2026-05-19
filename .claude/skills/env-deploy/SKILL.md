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
| 2 — Dockerized local stack | `feat(dev): docker + sandbox` | merged (#45) |
| 3 — Preview pipeline | `ci(preview): anon Neon branch` | **this PR** |
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

## Preview pipeline (Fase 3)

Every PR gets its own **anonymized copy of production** as a database.

```
PR opened/pushed ─▶ .github/workflows/preview.yml
   1. POST Neon /branch_anonymized  (parent = prod default branch)
        → masked copy, referential integrity intact, fresh each push
   2. db:migrate on the branch      (applies THIS PR's new migrations)
   3. pin DATABASE_URL on the Vercel web+admin preview for this branch
   4. comment on the PR
PR closed ────────▶ .github/workflows/preview-cleanup.yml
   delete the Neon branch · purge R2 pr-<n>/ · unpin the Vercel env
```

We use **Neon's native PostgreSQL Anonymizer** (`POST /branch_anonymized`
with `masking_rules`), not a hand-rolled UPDATE script: one call creates
the branch *and* masks it, and Neon preserves FK integrity. Masking is
*static* (permanent on the branch), so the branch is recreated from fresh
prod data on every push — Neon's recommended workflow.

### Masking rules

`config/neon-masking-rules.json` is the source of truth (schema → table →
column → `anon.*` function). Two intents:

- **Realistic fakes** (`anon.dummy_free_email/name/phone_number`) for
  emails / names / phones — preview data stays "very real".
- **Hard scrub** (`anon.partial(col,0,'redacted',0)`) for
  tokens/passwords/OAuth/private storage paths — destroyed, not faked.

FK columns and PKs are never masked (Neon keeps referential integrity, so
the loyalty graph stays realistic). `organization.name/slug` stay clear
(the franchise name isn't PII). Add a column → add a rule here; verify the
`anon.*` name against the Anonymizer version your Neon project ships.

### One-time setup

Repo **variable** `PREVIEW_PIPELINE_ENABLED=true` (the gate — both
workflows are inert until set, so this PR is non-breaking). Repo
**secrets**: `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_DATABASE_NAME`,
`NEON_ROLE_NAME`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID_WEB`,
`VERCEL_PROJECT_ID_ADMIN`. Optional: `NEON_PARENT_BRANCH_ID` (else the
project default branch), `VERCEL_TEAM_ID`, `R2_*` (only if you opt a
branch into real R2). Neon's anonymized-branch feature requires a plan
that includes it.

### Expensive third parties = outbox

Preview keeps Resend/Twilio on `outbox` (Infisical `preview` env +
the `VERCEL_ENV=preview` provider cascade) — no real sends, rows land in
the `*_outbox` tables, reachable from the `(dev)` views. No code here;
it's the Fase 1 matrix + existing cascade.

### Storage in preview

Previews default to `STORAGE_PROVIDER=memory` (the existing cascade when
`R2_BUCKET` is unset) — **zero R2 writes, zero saturation, no cleanup
needed**. To validate real R2 on one preview, use the per-branch override
below with the `pr-<n>/` key convention; `preview-cleanup.yml` purges
that prefix on close.

### Per-branch override (test a real third party on ONE preview)

All channels are `outbox` in preview (recipients are anonymized →
real sends would bounce). To make ONE preview branch use a real third
party, pin **branch-scoped** Vercel env vars with
`scripts/vercel/set-preview-env.ts` (`ENV_KEY`/`ENV_VALUE`, scoped to
`GIT_BRANCH`). Concrete — test real Resend on branch `fix/email`:

```bash
for kv in EMAIL_PROVIDER=resend \
          RESEND_API_KEY=re_xxx \
          "EMAIL_FROM=T4 <noreply@yourdomain>"; do
  GIT_BRANCH=fix/email \
  ENV_KEY="${kv%%=*}" ENV_VALUE="${kv#*=}" \
    bun run scripts/vercel/set-preview-env.ts
done
```

Same shape for `WHATSAPP_PROVIDER=twilio` + `TWILIO_*`, etc. Only that
preview changes; every other PR stays on `outbox`. On PR close,
`preview-cleanup.yml` removes **every** branch-scoped var (the pinned
`DATABASE_URL` and any overrides), so nothing leaks.

### Logging into a preview (anonymized data)

Masking fakes every email/phone, so you can't log in as a real user. The
pipeline RESTORES the owner's real email (`johinsdev@gmail.com`) on the
preview branch (matched via `member.role=owner` → `user_id`; the PK isn't
masked) so **Google login works for the owner**. To act as a cashier/staff
in a preview, the owner uses Better Auth **impersonate** — staff accounts
are not separately restored. (Built in Fase 4 alongside the Google
preview-vs-prod client split.)

### Observability in preview

No Better Stack in preview (prod-only). Errors → **Sentry with
`environment=preview`** (wired in Fase 4, enabled for preview AND prod,
not prod-only). Plain logs → Vercel runtime logs. That's the agreed
split: Sentry for exceptions, Vercel for logs.

### Future: Cloudflare Workers (Hono API)

When the tRPC layer is extracted to a Hono app on Cloudflare Workers, it
slots in here: a `wrangler deploy --env preview` step in `preview.yml`
reading `/shared` + a new `/api` Infisical folder, its own
`*.workers.dev` preview URL pinned alongside the Vercel ones. Not built —
documented so the shape is known.

---

## Future phases (placeholders — do not implement here)

- **Fase 4**: `.github/workflows/deploy-prod.yml` — Neon snapshot +
  migrate, re-introduced lazy `@loyalty/db` + lazy jobs env +
  `syncEnvVars`, Slack deploy notify, `check-env.ts` gate. Plus the
  preview refinements decided in Fase 3 review:
  - **dedicated per-preview** PartyKit worker + Trigger env per PR (not
    shared prod workers) — both `preview.yml` and prod deploy.
  - **Sentry** in web/admin/jobs, enabled for `preview` AND `prod`
    (`environment` tag), net-new.
  - **Google OAuth** preview-vs-prod client split + the
    `preview-restore-owner` step (un-mask `johinsdev@gmail.com` so the
    owner can Google-login a preview; cashiers via impersonate).
- **Fase 5**: `check-env.ts` as a hard gate on preview + prod; secret
  rotation runbook across all surfaces.
