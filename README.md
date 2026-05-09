# loyalty-app

Multi-tenant CRM and loyalty program. Live pilot in a single T4 tea franchise; architecture is built so that "going SaaS" later is a config change, not a rewrite.

> **Status:** MVP under active development. The customer-facing PWA, admin CRM, observability, CI/CD, and deploy pipeline are all wired up. Domain logic (points, redemption, KPIs) is the next milestone.

---

## What's in here

```
apps/
├── web/           Customer PWA — installable, offline-tolerant (Next 15, port 3002)
├── admin/         Staff CRM — tenant management, dashboards (Next 15, port 3003)
└── e2e/           Playwright suite (scaffold, specs to come)

packages/
├── api/           tRPC v11 routers (consumed by web + admin)
├── auth/          Better Auth (server + client, organization plugin = multi-tenant)
├── db/            Drizzle ORM + Neon Postgres client + schema
├── jobs/          Trigger.dev v3 background tasks (cron, webhooks, async work)
├── log/           Provider-agnostic logger (Pino + Better Stack + console + silent)
├── ui/            Shared design system (Tailwind v4, shadcn-style components)
└── tooling/       Shared configs — tsconfig presets, oxlint, oxformat, vitest

.claude/skills/   In-repo runbooks for every operational area (see "Skills" below)
.github/          CI workflow, CODEOWNERS, PR template
```

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime / package manager | **Bun** 1.2 | Fast install, fast script runner, native TS, monorepo workspaces |
| Build orchestrator | **Turborepo** 2 | Caching + `--filter` for per-app builds |
| Web framework | **Next.js 15** (App Router, RSC) | App Router + metadata routes power both apps |
| UI | **React 19** + **Tailwind v4** + shadcn-style components in `@loyalty/ui` |
| API | **tRPC v11** in `@loyalty/api` | End-to-end typesafe; ready to extract to a standalone service later |
| Auth | **Better Auth** + `organization` plugin | Multi-tenant from day one |
| Database | **Neon Postgres** + **Drizzle ORM** | Serverless Postgres, ergonomic types |
| Background jobs | **Trigger.dev v3** | Reliable cron + retries, dev-server with replay |
| PWA | **`@serwist/next`** (Workbox successor) | Installable web app for the customer flow |
| Observability | **Better Stack** (logs + uptime + status pages + alerts) + **`@loyalty/log`** abstraction |
| Lint | **oxlint** | Fast, no plugins to maintain |
| Format | **oxlint --fix** today; **oxformat** when stable |
| Commits | **commitlint** (Conventional Commits) + **lefthook** pre-commit / commit-msg hooks |
| Dead code | **knip** |
| Tests | **vitest** (unit) + **Playwright** (e2e, scaffolded) |
| Hosting | **Vercel** (Git auto-deploy) — one project per app |
| CI | **GitHub Actions** — validate-only (no deploy steps; Vercel handles that) |

Pinned versions live in the root `package.json#packageManager` and per-package `package.json#dependencies`.

---

## Quick start

```bash
# 1. Install dependencies (Bun is required: 1.2+)
bun install

# 2. Copy env template + fill in values
cp .env.example .env
# Required to run anything:
#   DATABASE_URL          (Neon pooled connection string)
#   BETTER_AUTH_SECRET    (openssl rand -base64 32)
# Required for jobs:
#   TRIGGER_PROJECT_ID
#   TRIGGER_SECRET_KEY
# See .env.example — vars are grouped by where they are consumed.

# 3. Generate + apply the initial DB migration
bun run db:generate
bun run db:migrate

# 4. Start both apps
bun run dev
# → web   on http://localhost:3002
# → admin on http://localhost:3003
```

In a second terminal (optional, when you're working on background jobs):

```bash
bun run jobs:dev   # Trigger.dev dev server with hot reload
```

---

## Day-to-day commands

| Script | What it does |
| --- | --- |
| `bun run dev` | Starts web + admin (Turbo runs both in parallel) |
| `bun run build` | Builds every app and package |
| `bun run lint` | oxlint across the repo (read-only) |
| `bun run lint:fix` | oxlint auto-fix |
| `bun run format` | Same as lint:fix today (oxformat once stable) |
| `bun run typecheck` | `tsc --noEmit` in every workspace |
| `bun run test` | Vitest across every package (excludes `apps/e2e`) |
| `bun run e2e` | Playwright (when specs land) |
| `bun run knip` | Dead code / unused deps / unused exports |
| `bun run db:generate` | Generate a new Drizzle migration from the schema |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Open Drizzle Studio (web GUI for the DB) |
| `bun run jobs:dev` | Trigger.dev dev server |
| `bun run jobs:deploy` | Deploy jobs to Trigger.dev cloud |
| `bun run clean` | Wipe `.next`, `.turbo`, `node_modules` everywhere |

---

## How code reaches production

```
git checkout -b feat/<short-name>      # 1. branch off main
… edit, commit …                        #    (Conventional Commits enforced)
git push -u origin feat/<short-name>   # 2. push
gh pr create                            # 3. open a PR (template auto-fills)
                                        # 4. CI runs the `validate` job
                                        #    (lint + knip + typecheck + test)
                                        # 5. Vercel auto-deploys both apps
                                        #    to preview URLs (commented on PR)
                                        # 6. merge → Vercel promotes to prod
```

Direct pushes to `main` are blocked by branch protection. The full ruleset and CI behavior is in `.claude/skills/ci-cd/SKILL.md`.

---

## Conventions

### Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by `commitlint` on `commit-msg` hook.

```
feat(web): add install prompt
fix(auth): use VERCEL_URL fallback for trustedOrigins
docs(ci): document Sensitive env-var trap on Vercel
chore(deps): bump @serwist/next to 9.0.10
```

Allowed scopes (pinned in `commitlint.config.ts`): `admin`, `web`, `api`, `auth`, `db`, `e2e`, `jobs`, `log`, `ui`, `tooling`, `ci`, `deps`, `repo`.

### Languages

- **Code, comments, errors, commits, PR descriptions, READMEs** → English.
- **Linear (issues, projects, milestones, labels)** → Spanish (the founder's partner reads it).

### Comments

Default to writing none. Add a comment only when the *why* isn't obvious from the code: a hidden constraint, a workaround, a non-obvious invariant. Don't restate what the code does.

### Migrations

Never edit files in `packages/db/migrations/` by hand. Always: change the schema, then `bun run db:generate`. Drizzle generates a clean, reviewable diff.

---

## Configuration boundaries

The repo is multi-tenant by data, multi-runtime by deployment. Where things live:

| Config / secret | Goes in `.env` (local)? | Vercel project env? | Trigger.dev project env? |
| --- | :-: | :-: | :-: |
| `DATABASE_URL` | yes | both apps | yes |
| `BETTER_AUTH_SECRET` | yes | admin only | no |
| `BETTER_AUTH_URL` | optional override | optional override | no |
| `NEXT_PUBLIC_APP_URL` | optional override | optional override | no |
| `BETTER_STACK_SOURCE_TOKEN_<APP>` | yes (per app) | per app | per service |
| `BETTER_STACK_API_TOKEN` | yes | **no** (MCP only) | **no** |
| `SLACK_BOT_TOKEN` | yes | **no** (MCP only) | **no** |
| `TRIGGER_PROJECT_ID` / `TRIGGER_SECRET_KEY` | yes | no | yes |

`.env.example` is the canonical list with rationale for each var. Everything is grouped by consumer (MCP / shared / web / admin / jobs / overrides).

### Why `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` are optional

`apps/{web,admin}/lib/app-url.ts` exposes a `getAppUrl()` helper that cascades:

```
browser  → window.location.origin
server   → explicit env > VERCEL_URL > localhost:300{2,3}
```

Vercel injects `VERCEL_URL` automatically per deploy, so previews work with zero config. You only set the env vars explicitly when you have a custom domain in production (or want to test cross-app auth flows in preview).

---

## Observability

We instrument once, route to the right sink at runtime.

- **`@loyalty/log`** is the only logger surface app code touches. It's provider-agnostic — the same call (`log.info("...")`) goes to console in dev, Better Stack in prod, or a fake sink in tests.
- **Channels** (transports): `pino`, `console`, `silent`, `better-stack`. The active channel is picked at boot from `BETTER_STACK_SOURCE_TOKEN_*` and `LOG_CHANNEL` env vars.
- **Per-service Better Stack sources** — web, admin, jobs each ingest into their own source so dashboards stay clean.
- **Uptime monitors** — Better Stack polls `/api/health` on web + admin every 3 min. Failures escalate to Slack `#alerts-loyalty`.
- **Alerts** — chart-alerts on log levels (e.g. error spike) and on uptime; routed to Slack.
- **Status page** — pending the production custom domain.

Day-to-day operations on Better Stack happen through its **MCP** (registered in `.mcp.json`); see `.claude/skills/better-stack/SKILL.md` for tool reference.

---

## PWA (apps/web)

The customer app ships as an installable PWA.

- Manifest at `/manifest.webmanifest` (declared in `apps/web/app/manifest.ts`).
- Service worker at `/sw.js`, generated by `@serwist/next` from `apps/web/app/sw.ts`.
- Offline fallback page at `/offline`.
- `<InstallPrompt />` button captures `beforeinstallprompt` and offers Add-to-Home-Screen on supported browsers.
- Cache strategy:
  - `_next/static/*` → cache-first (long TTL).
  - HTML pages → network-first, fall through to `/offline`.
  - `/api/*`, `/trpc/*` → **not cached** (auth-bound, user-scoped).
  - Images → cache-first (30-day TTL).
- PWA is **disabled in dev** so HMR isn't fighting cache invalidation. Run `bun --cwd apps/web run build && bun --cwd apps/web run start` to exercise it locally.

Today's icons are placeholder green SVGs with the letter "L". Brand assets get swapped in `apps/web/public/icons/` when the franchise design lands.

Deep dive: `.claude/skills/pwa/SKILL.md`.

---

## Skills (in-repo runbooks)

`.claude/skills/<area>/SKILL.md` is the canonical reference for each operational concern. Skills are written for both human teammates and Claude Code as an in-context guide.

| Skill | What it covers |
| --- | --- |
| `pwa` | Install/offline behavior, cache strategy, icon refresh, Lighthouse + DevTools workflow, gotchas |
| `ci-cd` | Pipeline architecture (validate-only), branch protection, opening PRs, troubleshooting |
| `vercel` | Per-project setup, env vars, Sensitive trap, MCP usage, rollback flow |
| `better-stack` | Logs/uptime/dashboards/alerts via the BS MCP, source token model |
| `log` | `@loyalty/log` API + channel design + how to add a new transport |
| `slack` | Bot setup, scopes, token rotation, "not_in_channel" debugging |
| `tooling` | oxlint + commitlint + lefthook conventions, allowed commit scopes |
| `drizzle` / `trpc` / `next-best-practices` / `bun` / `turborepo` / `neon-postgres` | Framework-specific patterns and best practices |

A few are sourced from the broader Claude Code skills ecosystem (`bun`, `turborepo`, `neon-postgres`, etc.); the rest are authored locally for this repo.

---

## MCP servers

Wired in `.mcp.json` for use from inside Claude Code:

| Server | Surface | Notes |
| --- | --- | --- |
| `linear-server` | HTTP, OAuth | Tickets, projects, milestones (everything in Spanish) |
| `vercel` | HTTP, OAuth | Read-only on projects, deployments, runtime + build logs |
| `better-stack` | HTTP, bearer token | Uptime API (monitors, status pages, incidents) |
| `better-stack-telemetry` | HTTP, bearer token | Telemetry API (sources, dashboards, charts, alerts) |
| `slack` | stdio (`@modelcontextprotocol/server-slack`) | Posts messages, reactions, channel history |

The two Better Stack tokens and the Slack bot token live in `.env`; HTTP MCP servers don't read `.env` directly, so the repo ships an `.envrc` that direnv sources into your shell — that way Claude Code resolves `${VAR}` at handshake time. The Slack stdio server is wrapped with `dotenv-cli` and reads `.env` directly.

---

## Repository layout in detail

### `apps/web` — customer PWA (port 3002)

Next 15 App Router. Customer-facing flow: sign in, see points, redeem rewards, scan QR (future). PWA scaffold (`manifest.ts`, `sw.ts`, `offline`, `<InstallPrompt />`) lives here.

### `apps/admin` — staff CRM (port 3003)

Next 15 App Router. Tenant management, customer lookup, KPI dashboards, manual point adjustments. Owns the Better Auth server (`/api/auth/*` route handler).

### `apps/e2e` — Playwright suite

Scaffold only today. Specs in `tests/*.{web,admin}.spec.ts` will exercise health endpoints + critical user flows. CI's `e2e` job is gated `if: false` until specs land.

### `packages/api` — tRPC routers

The single source of truth for API shape. Both `apps/web` and `apps/admin` consume the typed client. When the API needs to leave the monolith, this package becomes a standalone service.

### `packages/auth` — Better Auth setup

Server (`server.ts`) + browser client (`client.ts`). The `organization` plugin gives multi-tenant scoping out of the box.

### `packages/db` — Drizzle + Neon

Schema, migrations (auto-generated), and the `db` client export. Other packages import only `db`.

### `packages/jobs` — Trigger.dev tasks

Cron + webhook + async work. Today: empty scaffold. KPI rollup, point expiration, and email/SMS notifications will live here.

### `packages/log` — `@loyalty/log`

Logger abstraction. Each app has a bootstrap module (`apps/<app>/lib/log.ts`) that constructs a `LogManager` with the right channels for that runtime. Exports `log` for app code.

### `packages/ui` — shared components

Tailwind v4 + shadcn-style primitives. Imported by `apps/web` and `apps/admin`.

### `packages/tooling/*` — shared configs

`tsconfig` presets (base, nextjs), `oxlint-config`, `oxformat-config`, `vitest-config`. Per-app `tsconfig.json` extends from here.

---

## Local development gotchas

- **Trigger.dev v3 needs Node ≥ 20** (its CLI). Bun runs everything else. Both must be in `$PATH`.
- **Neon HTTP driver** works in RSC and Edge. Long-lived transactions need `@neondatabase/serverless`'s `Pool` (websocket) — not the default driver.
- **Better Auth `trustedOrigins`** is now derived dynamically from `VERCEL_URL` + explicit overrides (see `packages/auth/src/server.ts`). Cross-app auth in preview deploys requires explicit `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` env vars on the relevant Vercel project — preview deploys of admin and web have different `VERCEL_URL`s.
- **Service worker disabled in dev** — set in `apps/web/next.config.ts` to keep HMR sane. Build + start to test PWA features locally.
- **Sensitive env vars in Vercel** — Vercel won't return them via `vercel pull`. Mark Plain Text for any var the build needs to read at compile time. Full explainer in `.claude/skills/vercel/SKILL.md`.

---

## Architecture decisions that surprise people

- **CI does NOT deploy.** GitHub Actions only validates (lint/knip/typecheck/test). Vercel's native Git integration handles deploys. We tried CI-driven `vercel build --prebuilt` and it can't read Sensitive env vars; splitting the contract this way keeps both security and simplicity.
- **One Vercel project per Next app**, never reused. Tedious for env vars but isolates accidents — admin downtime doesn't take web with it.
- **No `vercel.json`** unless we need cron/redirects/etc. The Vercel project UI handles the common case.
- **Workspace deps via `workspace:*`**. Internal packages are imported by name (`@loyalty/db`) and resolve through Bun's workspace feature — no `paths` mapping in tsconfig.
- **Singleton Better Auth** in `packages/auth`. Auth lives at `/api/auth/*` on whichever app the user is on; the client uses relative URLs.
- **Linear in Spanish, repo in English.** Every visible Linear surface (tickets, projects, milestones) is Spanish for the team. Code, commits, comments, READMEs are English. The boundary stops being awkward once you internalize it.

---

## License

Private — pilot phase. Licensing decision deferred to post-MVP.
