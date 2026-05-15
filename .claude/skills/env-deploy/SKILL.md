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
| 1 — Infisical source of truth | `chore(env): adopt Infisical` | **this PR** |
| 2 — Dockerized local stack | `feat(dev): docker + sandbox` | planned |
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

---

## Future phases (placeholders — do not implement here)

- **Fase 2**: `docker-compose.yml` (postgres + neon-http-proxy + redis +
  partykit + web + admin; Trigger stays host). `dev:docker` + `sandbox`
  scripts. Section added in that PR.
- **Fase 3**: `.github/workflows/preview.yml` — Neon branch from prod,
  `sanitize-for-preview.ts`, Trigger preview, R2 `pr-<n>/` prefix,
  per-branch override doc, Cloudflare/Hono API placeholder.
- **Fase 4**: `.github/workflows/deploy-prod.yml` — Neon snapshot +
  migrate, re-introduced lazy `@loyalty/db` + lazy jobs env +
  `syncEnvVars`, Trigger/PartyKit deploy, Sentry net-new, Google
  preview-vs-prod split, Slack deploy notify, `check-env.ts` gate.
- **Fase 5**: `check-env.ts` as a hard gate on preview + prod; secret
  rotation runbook across all surfaces.
