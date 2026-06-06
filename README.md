# loyalty-app

Monorepo for a CRM + loyalty program. Pilot launches in a single T4 tea-franchise store, with a multi-tenant architecture ready to SaaS-ify.

> **Status:** MVP under active development. Customer PWA, admin CRM, observability, CI/CD, deploy pipeline, UI library, visual docs, and i18n are all wired up. Next milestone is the domain logic (points, redemptions, KPIs).

For a Claude Code session: start with [`CLAUDE.md`](./CLAUDE.md). Operational conventions live in [`.claude/skills/<area>/SKILL.md`](./.claude/skills/).

## Stack

- **Runtime / package manager:** Bun 1.2
- **Monorepo:** Turborepo 2
- **Frontend:** Next.js 16 (App Router) · React 19.2 · Tailwind v4
- **i18n:** next-intl in `apps/web` and `apps/admin` (es default, en second locale)
- **PWA:** `@serwist/next` (installable, offline-tolerant) in `apps/web`
- **API:** tRPC v11 (`packages/api`) served by a standalone **Hono app on Cloudflare Workers** (`apps/api`, live at `api.t4diverclub.app`) — see "Production architecture & environments"
- **Auth:** Better Auth + organization plugin (multi-tenant)
- **DB:** Turso (libSQL) + Drizzle ORM
- **Background jobs / cron:** Trigger.dev v3
- **Observability:** Better Stack (logs + uptime + status + alerts) via `@loyalty/log`
- **WhatsApp:** `@loyalty/whatsapp` — provider-agnostic (Twilio in prod, DB outbox in preview, log/folder in dev)
- **Push notifications:** `@loyalty/push` — unified Web Push (VAPID) + Expo Push abstraction, with `auto` fan-out by token platform
- **Real-time:** `@loyalty/realtime` + `partykit/` — Cloudflare WebSockets via PartyKit. One Party per concern (customer rooms today, org/chat documented for later), HMAC-signed publishes from Next, HS256 tickets for browser auth
- **File storage:** `@loyalty/storage` — three providers (memory / local / R2), presigned PUT + GET URLs everywhere. Browser uploads direct to R2 in prod, never via Vercel functions
- **UI:** shadcn/ui on top of Base UI primitives (`@base-ui/react`) in `packages/ui`
- **Visual docs:** Storybook 9 in `apps/storybook` (auto-deployed as a third Vercel project)
- **Lint:** oxlint · **Format:** `oxlint --fix` (oxformat once stable)
- **Hooks:** lefthook · **Commits:** commitlint (Conventional Commits)
- **Dead code:** knip
- **Tests:** vitest (unit) + Playwright (e2e, scaffolded)
- **Hosting:** Vercel (auto-deploy from Git) — one project per Next app; the API runs on Cloudflare Workers
- **CI:** GitHub Actions — `validate` (lint + knip + typecheck + test) on every PR; a merge to `main` also deploys the backend (API Worker + DB migrate + Trigger jobs). Vercel handles the front-end deploys.

## Layout

```
apps/
├── web/         Customer PWA — installable, offline-tolerant (Next 16, port 3002)
├── admin/       Staff CRM — tenant management, dashboards (Next 16, port 3003)
├── storybook/   Visual docs for @loyalty/ui (Storybook 9, port 6006)
└── e2e/         Playwright suite (scaffold; specs to come)

packages/
├── api/         tRPC v11 routers
├── auth/        Better Auth (server + client, organization plugin)
├── db/          Drizzle ORM + libSQL/Turso client + schema
├── jobs/        Trigger.dev v4 tasks
├── log/         Provider-agnostic logger (Pino + Better Stack + console + silent)
├── ui/          shadcn (Base UI) + Tailwind v4 tokens
├── whatsapp/    Provider-agnostic WhatsApp sender (Twilio + log + folder + outbox)
└── tooling/     Shared presets — tsconfig, oxlint, oxformat, vitest

.claude/skills/  Operational runbooks per area (see "Skills" below)
.github/         CI workflow + CODEOWNERS + PR template
```

## Setup — new contributor, zero to running

**The dev model:** Infisical's `dev` environment is the single source of truth
for all env (DB → a **local** libSQL, message providers → `log`, cache →
`memory`, real auth/Trigger/Google secrets). **Docker** runs the backing
services (libSQL, redis). The **apps run natively on the host** — Infisical
injects the env, Docker provides the services they talk to.

### 1. Host tools (one-time — fresh Mac)

Everything installs via [Homebrew](https://brew.sh). On a brand-new Mac:

```bash
# Homebrew (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

xcode-select --install                        # git + compilers (skip if already there)
brew install oven-sh/bun/bun                  # Bun 1.2+  — runtime + package manager (runs apps, scripts, tests)
brew install node                             # Node ≥ 20 — the Trigger.dev CLI + partykit need it on $PATH
brew install --cask docker                    # Docker Desktop — backing services (libSQL, redis)
brew install infisical/get-cli/infisical      # Infisical CLI — pulls the dev env
```

| Tool | Why it's needed |
| --- | --- |
| **Bun 1.2+** | Runs everything — the apps, all `bun run …` scripts, tests, the package manager. |
| **Node ≥ 20** | Only the Trigger.dev CLI (`jobs:dev`) and partykit need Node; Bun runs the rest. Both must be on `$PATH`. |
| **Docker Desktop** | Hosts the local libSQL + redis (start it before step 4). |
| **Infisical CLI** | Pulls the `dev` env (the source of truth) when you run `bun run …`. |
| **git** | Comes with the Xcode Command Line Tools. |

Then ask the owner to **invite you to the Infisical `loyalty-app` project**
(Organization → Access Control → Members) so your login can read the `dev`
secrets.

### 2. Clone + install

```bash
git clone <repo> && cd loyalty-app
bun install
```

### 3. Log into Infisical

```bash
infisical login        # browser auth — .infisical.json already points at the project
```

### 4. Bring up the backing services (Docker)

```bash
bun run dev:services   # libSQL on :8080, redis on :6379  (Docker Desktop must be running)
```

### 5. Create the schema in your local DB

```bash
bun run db:migrate     # Infisical injects DATABASE_URL=http://localhost:8080 → migrates the local libSQL
```

### 6. Run the apps (host)

```bash
bun run dev            # web :3002 + admin :3003 + API Worker :8787 + jobs — secrets auto-injected
```

That's it. Daily, it's just steps 4 + 6 (`bun run dev:services` once Docker is
up, then `bun run dev`). Storybook + the email preview are NOT in `bun run dev`
(they're rarely needed together and slow the boot) — run them on demand below.

**Optional / when you need them** (separate terminals):

```bash
bun run db:seed:owner --email=you@example.com   # promote yourself to org owner
docker compose up partykit                        # realtime server (only when working on realtime)
bun --cwd apps/storybook run dev                  # Storybook on :6006
bun --cwd packages/email-templates run dev        # React Email preview on :3008
bun run api:dev                                   # API Worker alone on :8787 (also in `bun run dev`)
```

The API Worker is the in-progress backend extraction (tRPC + Better Auth as one
Cloudflare Worker), now part of `bun run dev`; `bun run api:dev` is the focused
Worker-only variant. `wrangler dev` runs the Worker in workerd, which does NOT
inherit the shell env — so its secrets come from `apps/api/.dev.vars`, generated
from Infisical by `scripts/api/gen-dev-vars.sh` on every boot (gitignored). It
reads the same local libSQL as the apps, so `bun run dev:services` must be up.
`NEXT_PUBLIC_API_URL=http://localhost:8787` is set in Infisical dev `/shared`, so
the apps already point at the Worker; unset it (or `NO_INFISICAL=1`) to fall back
to their in-process `/api/trpc` + `/api/auth` routes. Cookies on `localhost` are
shared across ports, so auth works `:3002`/`:3003` ↔ `:8787` without custom
domains.

Stop the services with `bun run dev:services:down`. Validate a single real
third party from your machine with `bun run sandbox -- --email=resend`.

### Alternative: the whole stack in Docker

If you'd rather not run the apps on the host:

```bash
bun run dev:docker        # libsql + redis + migrate + partykit + web + admin, all in containers
```

Works fully offline with dev-safe defaults even without Infisical (`${VAR:-default}`
fallbacks: log providers, memory cache, local storage). Full runbook:
`.claude/skills/env-deploy/SKILL.md`.

## Database — Drizzle + Turso (libSQL)

The **schema is the source of truth**: `packages/db/src/schema/*.ts`, written
as Drizzle `sqliteTable`s. Dev runs against the local libSQL container
(`bun run dev:services`); prod is Turso. Same code, same driver
(`@libsql/client`) — only `DATABASE_URL` changes per environment, and Infisical
injects it (`http://localhost:8080` in dev, the `libsql://…` URL + token in
prod). You never write SQL by hand — you edit the schema and Drizzle generates
the migration.

### Changing the schema (the migration loop)

> **Never hand-edit files in `packages/db/migrations/`** — they're generated and
> tracked with snapshots. Hand edits desync the migration history.

```bash
# 1. Edit the table          packages/db/src/schema/<file>.ts
# 2. Generate the migration
bun run db:generate          # drizzle-kit diffs schema ↔ history → migrations/NNNN_<name>.sql (review it)
# 3. Apply it to your local DB
bun run db:migrate           # Infisical → DATABASE_URL=http://localhost:8080 → applies pending migrations
# 4. Commit the schema change AND the generated migration together
```

`db:migrate` is also how prod migrations run (just with the prod `DATABASE_URL`).
Applied migrations are tracked in the `__drizzle_migrations` table, so
re-running is a no-op — safe and idempotent.

### Browsing / editing data — Drizzle Studio

```bash
bun run db:studio            # opens https://local.drizzle.studio against your DATABASE_URL
```

A web UI to browse and edit rows. In dev it points at the local libSQL, so make
sure `bun run dev:services` is up first.

### Command reference

| Command | What it does |
| --- | --- |
| `bun run db:generate` | Generate a migration from schema changes (no DB connection needed) |
| `bun run db:migrate` | Apply pending migrations to `DATABASE_URL` (dev = local libSQL via Infisical) |
| `bun run db:migrate:docker` | Apply to the local libSQL at `:8080` **without** Infisical (host-run; waits for the container) |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:push` | Push the schema straight to the DB **without** a migration file — quick local experiments only, **never** on a shared/prod DB |
| `bun run db:seed:owner --email=…` | Promote a signed-up user to `owner` of the singleton org |

**libSQL/SQLite type patterns** (how the schema differs from Postgres): text PKs
default via `.$defaultFn(() => crypto.randomUUID())`, timestamps are
`integer({ mode: "timestamp" })`, booleans are `integer({ mode: "boolean" })`,
JSON columns are `text({ mode: "json" })`. Deeper Drizzle patterns live in the
`drizzle` skill.

## i18n

Both `apps/web` and `apps/admin` are internationalized with **next-intl** (Spanish default, English second locale). Full details in the `next-intl` skill (`.claude/skills/next-intl/SKILL.md`). Quick reference:

- **Locales:** `es` (default) and `en`. To add another, edit `apps/<app>/i18n/routing.ts` and create `apps/<app>/messages/<code>.json` in each app.
- **URLs:** `localePrefix: "as-needed"` → `/perfil` (es) and `/en/profile` (en). Folders under `app/[locale]/` are in English (`profile`, `card`, `customers`, `rewards`) — they're code. The `pathnames` map translates each canonical route to its per-locale public URL.
- **Language detection:** `proxy.ts` reads the `NEXT_LOCALE` cookie → `Accept-Language` header → falls back to `es`.
- **Strings:** never inline in JSX inside `app/[locale]/`. They go in `messages/{es,en}.json`.
- **Navigation:** import `Link` / `useRouter` / `usePathname` / `redirect` from `@/i18n/navigation`, **never** from `next/link` / `next/navigation`.
- **Locale switcher:** `apps/<app>/components/locale-switcher.tsx` (toggle button on top of the `@loyalty/ui` `Button`).
- **`proxy.ts`** (not `middleware.ts`): Next 16 renamed the file convention. Always use `proxy.ts`.
- **VSCode:** install the recommended **i18n Ally** extension (`.vscode/extensions.json`) for inline translations and missing-key detection across both apps.

## Commands

| Script | What it does |
|---|---|
| `bun run dev` | Start web (3002) + admin (3003) + API Worker (8787) + jobs on the host (storybook, emails, partykit excluded — run on demand) |
| `bun run dev:services` | Bring up the backing services in Docker (libSQL :8080 + redis) for host dev |
| `bun run dev:services:down` | Stop the Docker backing services |
| `bun run api:dev` | API Worker alone (`wrangler dev` on :8787, Infisical-injected) — focused variant of what `bun run dev` already runs |
| `bun run build` | Build every app and package |
| `bun run lint` | oxlint across the whole repo (read-only) |
| `bun run lint:fix` | oxlint with autofix |
| `bun run format` | Equivalent to `lint:fix` today (oxformat once it stabilizes) |
| `bun run typecheck` | `tsc --noEmit` in every workspace |
| `bun run test` | Vitest in every package (excludes `apps/e2e`) |
| `bun run e2e` | Playwright (once specs land) |
| `bun run knip` | Dead code / unused deps / unused exports |
| `bun run dev:docker` | Whole dev stack in Docker (libsql + redis + migrate + partykit + web + admin) |
| `bun run db:migrate:docker` | Migrate the Dockerized libSQL from the host (the stack also auto-migrates on up) |
| `bun run sandbox -- --<channel>=<provider>` | Validate one real third party's credentials from your machine |
| `bun run env:bootstrap` | Create the Infisical folder structure (`-- --import .env --env dev` to migrate an old `.env`) |
| `bun run env:pull` | Export the current Infisical env as dotenv to stdout |
| `bun run env:check` | List every secret in the current Infisical env |
| `bun run db:generate` | Generate a Drizzle migration from the schema |
| `bun run db:migrate` | Apply migrations to Turso |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run jobs:dev` | Trigger.dev dev server |
| `bun run jobs:deploy` | Deploy jobs to Trigger.dev cloud |
| `bun --cwd apps/storybook run dev` | Storybook locally (port 6006) |
| `bun --cwd apps/storybook run build` | Static Storybook build (`storybook-static/`) |
| `bun run clean` | Wipe `.next`, `.turbo`, `node_modules` everywhere |

## How code reaches production

```
git checkout -b feat/<name>            # 1. branch from main
… edit, commit …                       #    (Conventional Commits via commitlint)
git push -u origin feat/<name>         # 2. push
gh pr create                           # 3. open PR (template auto-filled)
                                       # 4. CI runs the `validate` job
                                       #    (lint + knip + typecheck + test)
                                       # 5. Vercel auto-deploys the 3 apps
                                       #    to preview URLs (commented on the PR)
                                       # 6. preview.yml gives the PR its own
                                       #    anonymized Neon branch (masked copy
                                       #    of prod) wired to its preview deploy
                                       # 7. merge → Vercel promotes to production
                                       #    (PR close → preview resources torn down)
```

Direct pushes to `main` are blocked by branch protection. The full rule is in `.claude/skills/ci-cd/SKILL.md`. The preview database pipeline (anonymized branches) is documented in the `env-deploy` skill. The backend Worker + jobs deploy pipeline (a merge to `main` ships the whole backend) is described in the next section.

## Production architecture & environments

The backend was extracted out of Next.js into a standalone **Hono API on Cloudflare Workers**, and the production cutover is done. The Next apps are now pure clients of that Worker.

### Architecture overview (live in prod)

```
                           api.t4diverclub.app
   ┌──────────────┐        ┌───────────────────────────┐
   │ admin.       │  tRPC  │  loyalty-api (Hono Worker) │
   │ t4diverclub  │ ◀────▶ │   /api/auth/*  Better Auth │      ┌──────────────┐
   │ .app (Vercel)│  auth  │   /trpc/*      appRouter   │ ───▶ │ Turso (libSQL)│
   └──────────────┘        │   nodejs_compat · "lean"   │      └──────────────┘
   ┌──────────────┐        └─────────────┬─────────────┘
   │ app.         │  tRPC                │ enqueue
   │ t4diverclub  │ ◀────▶               ▼
   │ .app (Vercel)│  auth        ┌────────────────┐   sends   ┌──────────────────┐
   │  PWA         │              │  Trigger.dev   │ ────────▶ │ Twilio / Resend /│
   └──────────────┘              │  jobs + cron   │           │ web-push (VAPID) │
          │                      └────────────────┘           └──────────────────┘
          │ wss
          ▼
   partykit.t4diverclub.app  (PartyKit cloud-prem on Cloudflare)
```

- **API** — a standalone Hono app deployed as one Cloudflare Worker (`loyalty-api`) at `https://api.t4diverclub.app`. It mounts Better Auth at `/api/auth/*` (a single issuer) and tRPC at `/trpc/*`, reusing `@loyalty/api`'s `appRouter` + `createContext` unchanged. `nodejs_compat` is on (Better Auth + crypto + `process.env`); the Worker is **"lean"** — heavy sends (Twilio/Resend/web-push) are enqueued to Trigger.dev jobs, never sent inline. DB access is `@libsql/client/web` against Turso.
- **Front-ends** — the Next.js apps on Vercel: admin (`https://admin.t4diverclub.app`) and the web/customer PWA (`https://app.t4diverclub.app`). They are pure clients: when `NEXT_PUBLIC_API_URL` is set they call the Worker for both tRPC and auth. Auth is **same-site cross-subdomain** — the Better Auth cookie is `Domain=.t4diverclub.app`, `SameSite=Lax`, `Secure`, so it's shared across `api.` / `admin.` / `app.` with no Bearer tokens. The cutover (flipping `NEXT_PUBLIC_API_URL` → the Worker) is **done in prod**.
- **Background jobs / cron** — Trigger.dev (Node). The Worker enqueues; the jobs do the actual sends and run scheduled work.
- **Realtime** — PartyKit, deployed cloud-prem on Cloudflare. There are **three separate parties** (one Worker each, deployed with a distinct `--name`): dev runs locally at `localhost:1999`; preview/staging is `partykit-staging.t4diverclub.app`; prod is `partykit.t4diverclub.app`. Each has its own `REALTIME_AUTH_SECRET`. **Gotcha:** PartyKit cloud-prem deploys a project as a single Worker named `<login>-<projectName>`, and `--domain` sets that Worker's one custom domain — so separate prod/staging parties **require different `--name` values**, otherwise the second deploy steals the domain from the first.
- **DB** — Turso (libSQL). Prod is the `loyalty-app` database; previews each get a per-PR masked clone; dev is a local SQLite (Docker libSQL on `:8080`).
- **Secrets** — Infisical (project `loyalty-app`). See "Infisical secret structure" below.

### Deploy pipeline (a merge to `main` ships the whole backend)

- **Front-ends** — Vercel's Git integration auto-deploys web, admin and storybook on every push to `main` (unchanged).
- **`.github/workflows/deploy-prod.yml`** — gated on the repo variable `PROD_DEPLOY_ENABLED=true`, path-filtered to `apps/api/**` + `packages/**`. It runs, in order: **DB migrate → API Worker deploy → Trigger.dev jobs deploy (+ env sync)**, then posts a summary to Slack. Migration runs first so code never deploys against an un-migrated DB. Worker deploys are **code-only** (`WORKER_DEPLOY_SKIP_SECRETS=true`) — its secrets persist across deploys; run `bun run worker:deploy:prod` locally to re-sync them after rotating one. The Trigger step uses `syncEnvVars` which **upserts** — it pushes the Infisical-injected vars (DB/auth/realtime/VAPID) without deleting the dashboard-managed ones (Twilio/Resend).
- **`.github/workflows/deploy-partykit.yml`** — path-filtered to `partykit/**`; redeploys the **prod party only**. Known gaps: it does **not** redeploy the staging party (staging must be redeployed separately when `partykit/**` changes), and it needs `PARTYKIT_TOKEN` in Infisical prod `/ci` to authenticate.
- **Manual deploy scripts** — `bun run worker:deploy:prod` (full Worker + secrets), `bun run partykit:deploy` (the party).
- **Per-PR previews** (`.github/workflows/preview.yml`) — clones + masks the prod DB, deploys a per-PR Worker (`api.pr-N.t4diverclub.app`) and FE subdomains (`admin.pr-N` / `app.pr-N`); `preview-cleanup.yml` tears it all down on PR close.
- **Slack notification** — `scripts/slack/notify-deploy.sh` posts to an Incoming Webhook (`SLACK_DEPLOY_WEBHOOK_URL` in Infisical prod `/ci`); inert until that key is set.

The **only** GitHub Actions secrets are the Infisical machine identity (`INFISICAL_MACHINE_IDENTITY_CLIENT_ID` / `INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET`). Everything else (Cloudflare, Vercel, Turso, Trigger, PartyKit creds) is pulled from Infisical at deploy time via `infisical run --env=prod`.

### Environment × concern matrix

This is the **target** for each environment. Some rows aren't fully wired yet — see "Not yet configured / TODO".

| Concern | Dev | Preview | Prod |
| --- | --- | --- | --- |
| Logs | console | console | Better Stack |
| A/B testing | PostHog | PostHog | PostHog |
| Events / analytics | PostHog | PostHog | PostHog |
| Auth — web | Google + Phone OTP | Phone OTP | Google + Phone OTP |
| Auth — admin | Password + Magic Link | Password + Magic Link | Magic Link |
| Email | console | outbox | Resend |
| SMS | console | outbox | Twilio |
| WhatsApp | console | outbox | Twilio |
| Push (web) | console | VAPID web-push | VAPID web-push |
| Storage | local | R2 + per-PR folder | R2 |
| Images | next (default) | next (default) | Cloudflare Images |
| Realtime | PartyKit (local :1999) | PartyKit + per-PR room prefix | PartyKit |
| Cron | Trigger.dev | Trigger.dev | Trigger.dev |
| Background tasks | Trigger.dev | Trigger.dev | Trigger.dev |
| Error tracking | null | null | Sentry |
| Cache | redis (Docker) | memory | Upstash |
| Rate limit | redis (Docker) | memory | Upstash |
| DB | SQLite (local) | Turso per-PR branch/clone | Turso |

### Third-party integrations (which environments use the real provider, not the no-op)

| Integration | Role | Envs |
| --- | --- | --- |
| Trigger.dev | jobs + cron | dev · preview · prod |
| Turso | DB | preview · prod |
| Upstash | cache + rate limit | prod (previews use memory) |
| Twilio | SMS + WhatsApp | prod |
| Sentry | error tracking | prod |
| Better Stack | logs / uptime / alerts | prod |
| PartyKit | realtime | dev · preview · prod |
| R2 | file storage | preview · prod |
| Cloudflare Images | image optimization | prod |
| Cloudflare Workers | API host | preview · prod |
| Google OAuth | login | see the auth rows |
| Resend | email | prod |
| PostHog | analytics + flags | prod |
| VAPID web-push | push | prod |

Plus the infra providers: **Vercel** (FE hosting), **Infisical** (secrets), **GitHub Actions** (CI + deploy).

### Infisical secret structure

Infisical (project `loyalty-app`) is the single source of truth. Three environments — `dev`, `staging` (the preview base), `prod` — each with these folders:

| Folder | Consumed by | Examples (key names only) |
| --- | --- | --- |
| `/shared` | FE apps + jobs — app config, FE-facing | `DATABASE_URL`, `*_PROVIDER`, `R2_*`, `NEXT_PUBLIC_*` |
| `/api` | the Worker only (**not** synced to the FE Vercel projects) | `BETTER_AUTH_SECRET`, `TURSO_AUTH_TOKEN`, `UPSTASH_*`, `GOOGLE_CLIENT_*`, `TRIGGER_SECRET_KEY`, `REALTIME_AUTH_SECRET`, Sentry DSN, Better Stack source |
| `/ci` | deploy creds (CI + manual deploy scripts) | `CLOUDFLARE_*`, `VERCEL_*`, `TURSO_*`, `TRIGGER_ACCESS_TOKEN`, `PARTYKIT_LOGIN` / `PARTYKIT_TOKEN`, `SLACK_DEPLOY_WEBHOOK_URL` |

The only GitHub Actions secrets are the Infisical machine identity (see the deploy pipeline above); all other deploy credentials are pulled from `/ci` at deploy time.

### Not yet configured / TODO

The matrix above is the target. These rows / steps are not fully wired yet:

- **Auth — admin**: the matrix targets Magic Link in prod, but admin **currently uses Google** in prod. The current state is: web = phone-OTP, admin = Google. A deferred auth refactor will move web → Google-only and admin → password + passwordless (Magic Link), matching the matrix.
- **SMS / WhatsApp / Email prod creds** (Twilio / Resend) currently live in the **Trigger.dev dashboard** (the jobs do the sends), not all in Infisical yet.
- **Pending one-time configs**: rotate the Upstash token; add `SLACK_DEPLOY_WEBHOOK_URL` to arm the Slack deploy notification; add `PARTYKIT_TOKEN` to arm `deploy-partykit.yml`; the step-6 FE env cleanup (drop the now-unused `/api/trpc` + `/api/auth` Next routes and make the FE env optional for DB/auth when going via the Worker); add a staging-party redeploy step to `deploy-partykit.yml`.

## Conventions

- **Commits:** Conventional Commits (`feat(admin): ...`, `fix(db): ...`).
  Valid scopes: `admin`, `web`, `api`, `auth`, `db`, `e2e`, `jobs`, `log`, `ui`, `tooling`, `ci`, `deps`, `repo`.
- **Language:** code, comments, errors, commits, PR descriptions, and READMEs in **English**. Linear (issues, projects, milestones) in **Spanish**. User-facing copy split per locale in `messages/{es,en}.json`.
- **Code comments:** minimal. Only when the *why* isn't obvious.
- **UI components:** shadcn copy-paste model — edit the files in `packages/ui/src/components/ui/<name>.tsx` directly. Don't wrap them.
- **Never** edit `migrations/` by hand — modify the schema and run `bun run db:generate`.

## Configuration boundaries

**Infisical is the single source of truth** for every secret across
`dev` / `preview` / `prod`. Secrets are organized into folders by consumer
and synced to each runtime — nothing is hand-entered into Vercel,
Trigger.dev or PartyKit.

| Infisical folder | Consumed by | Examples |
| --- | --- | --- |
| `/shared` | web + admin + jobs | `DATABASE_URL`, `*_PROVIDER`, `TWILIO_*`, `R2_*` |
| `/web` | apps/web only | `NEXT_PUBLIC_*`, `BETTER_STACK_*_WEB` |
| `/admin` | apps/admin only | `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_*` |
| `/jobs` | packages/jobs (Trigger.dev) | `TRIGGER_*`, `OUTBOX_RETENTION_DAYS` |
| `/partykit` | the realtime worker | `PARTYKIT_HOST`, `PARTYKIT_PROJECT` |
| `/mcp` | Claude Code MCP + CI **only** | `BETTER_STACK_API_TOKEN`, `SLACK_BOT_TOKEN` |

`.env.example` is the canonical matrix (variable → folder → which envs
differ → static/on-fly). The full runbook — setup, rotation, Vercel/CI/MCP
integration, troubleshooting — is in `.claude/skills/env-deploy/SKILL.md`.

### Why `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` are optional

`apps/{web,admin}/lib/app-url.ts` exposes a `getAppUrl()` helper that cascades:

```
browser  → window.location.origin
server   → explicit env > VERCEL_URL (auto-injected by Vercel) > localhost:300{2,3}
```

Set them explicitly only when there's a custom domain in production, or for cross-app auth testing on preview deploys.

## Observability

One logger surface (`@loyalty/log`), multiple sinks chosen at runtime.

- **Available channels:** `pino`, `console`, `silent`, `better-stack`.
- **Auto-activation:** if `BETTER_STACK_SOURCE_TOKEN_*` is set, the bootstrap uses `better-stack`. Otherwise, `pino` in dev.
- **Sources per service:** web, admin, jobs each have their own dedicated ingest.
- **Uptime monitors:** Better Stack polls `/api/health` on web + admin every 3 min. Failures escalate to Slack `#alerts-loyalty`.
- **Alerts:** chart-alerts on log levels (e.g. error spikes) + uptime, routed to Slack.

Day-to-day operation via the Better Stack MCP (registered in `.mcp.json`). See `.claude/skills/better-stack/SKILL.md`.

## PWA (apps/web)

The customer app ships as an installable PWA.

- Manifest at `/manifest.webmanifest` (declared in `apps/web/app/manifest.ts`).
- Service worker at `/sw.js`, generated by `@serwist/next` from `apps/web/app/sw.ts`.
- Offline page at `/offline`.
- `<InstallPrompt />` captures `beforeinstallprompt` and offers Add-to-Home-Screen where the browser supports it.
- Cache strategy:
  - `_next/static/*` → cache-first (long TTL).
  - HTML pages → network-first, fallback to `/offline`.
  - `/api/*`, `/trpc/*` → **not cached** (auth-bound, user-scoped).
  - Images → cache-first (30-day TTL).
- PWA is **disabled in dev** so HMR works. Build + start to exercise PWA behavior locally.

Deep dive: `.claude/skills/pwa/SKILL.md`.

## UI library (apps/storybook + packages/ui)

`@loyalty/ui` ships every shadcn/ui component on top of **Base UI** primitives (`@base-ui/react`), not Radix. ~55 components copied into the repo — you edit them in `packages/ui/src/components/ui/<name>.tsx`.

- **Theme tokens** in `packages/ui/styles/globals.css` (oklch, neutral base, T4 brand green placeholder until the brand kit).
- **Dark mode** via a `.dark` class on `<html>`.
- **Stories** in `apps/storybook/stories/<name>.stories.tsx` (CSF 3, one per component, with autodocs).
- **Storybook deploy:** Vercel project `loyalty-app-storybook`, auto-deployed from `main`, preview per PR.

To add a component: `bunx shadcn@latest add <name>` from `packages/ui`, then patch `@/cn` → `../../cn` and add to the barrel.

Deep dive: `.claude/skills/ui/SKILL.md`.

## Skills (repo runbooks)

`.claude/skills/<area>/SKILL.md` — canonical reference per operational area. Written for Claude Code and teammates.

| Skill | Covers |
| --- | --- |
| `next-intl` | i18n setup, server vs client patterns, locale switching, adding locales |
| `ui` | Component library, Base UI primitives, theme tokens, dark mode, Storybook |
| `pwa` | Install/offline, cache strategy, refreshing icons + brand, Lighthouse, gotchas |
| `env-deploy` | Infisical source of truth, folder→runtime mapping, local/Vercel/CI/MCP injection, secret rotation |
| `ci-cd` | Pipeline (validate-only), branch protection, opening PRs, troubleshooting |
| `vercel` | Per-project setup, env vars, Sensitive trap, MCP usage, rollback |
| `better-stack` | Logs/uptime/dashboards/alerts via BS MCP, source-token model |
| `log` | `@loyalty/log` API, channel design, adding a new transport |
| `whatsapp` | `@loyalty/whatsapp` API, four transports, outbox panel, E2E endpoint, FakeSender |
| `push` | `@loyalty/push` API, Web Push + Expo Push transports, subscription flow, outbox + token tables |
| `realtime` | `@loyalty/realtime` + `partykit/`, party patterns, ticket + HMAC auth, smoke page, future chatbot/org party stubs |
| `storage` | `@loyalty/storage` API, three providers (memory/local/R2), presigned URLs, R2 setup |
| `file-upload` | Dropzone primitive in `@loyalty/ui`, `useFileUpload` hook, react-hook-form bridge, Storybook stories |
| `api-filters` | `packages/api/src/features/*` pattern — router → service → repository + composable Filters |
| `slack` | Bot setup, scopes, token rotation, debugging "not_in_channel" |
| `tooling` | oxlint + commitlint + lefthook conventions, valid scopes |
| `drizzle` / `trpc` / `next-best-practices` / `bun` / `turborepo` / `neon-postgres` | Patterns + best practices per framework |

Skills authored locally in this repo: `next-intl`, `ui`, `pwa`, `whatsapp`, `sms`, `cache`, `email`, `push`, `realtime`, `storage`, `file-upload`, `api-filters`, `architecture-guard`, `env-deploy`, `ci-cd`, `vercel`, `better-stack`, `log`, `slack`, `tooling`. The rest come from the broader Claude Code skills ecosystem.

## MCP servers

Wired up in `.mcp.json` for use from Claude Code:

| Server | Surface | Notes |
| --- | --- | --- |
| `linear-server` | HTTP, OAuth | Tickets, projects, milestones (all in Spanish) |
| `vercel` | HTTP, OAuth | Read-only across projects, deployments, runtime + build logs |
| `better-stack` | HTTP, bearer | Uptime API (monitors, status pages, incidents) |
| `better-stack-telemetry` | HTTP, bearer | Telemetry API (sources, dashboards, charts, alerts) |
| `slack` | stdio (`@modelcontextprotocol/server-slack`) | Posts messages, reactions, channel history |

Tokens live in `.env`. HTTP MCP servers don't read `.env` directly — the repo ships an `.envrc` that direnv sources into the shell so Claude Code resolves `${VAR}` at handshake time.

## Common local-dev gotchas

- **Trigger.dev v3 requires Node ≥ 20** (its CLI). Bun runs everything else. Both must be on `$PATH`.
- **libSQL `@libsql/client`** works in RSC and Node runtimes. `DATABASE_URL` holds the `libsql://` URL (remote Turso) or `http://localhost:8080` (local `sqld`); `TURSO_AUTH_TOKEN` is required only for remote.
- **Better Auth `trustedOrigins`** is derived dynamically from `VERCEL_URL` + explicit overrides (see `packages/auth/src/server.ts`). Cross-app auth on preview deploys needs `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` set explicitly — admin and web preview deploys have different `VERCEL_URL`s.
- **Service worker disabled in dev** — set in `apps/web/next.config.ts` so it doesn't fight HMR. Build + start to test PWA locally.
- **Sensitive env vars in Vercel** — Vercel won't return them via `vercel pull`. Mark Plain Text for any var the build needs to read at compile time. Full explainer in `.claude/skills/vercel/SKILL.md`.
- **`@/cn` aliases only inside packages/ui** — shadcn components installed by the CLI write `@/cn`, which only resolves inside `packages/ui`. Patch to relative paths when adding new components (see the `ui` skill).
- **Next 16 renders dynamic by default.** Cache Components is opt-in (`cacheComponents: true` + `"use cache"` directives). The repo doesn't enable it yet — most loyalty pages need to be dynamic anyway (auth-aware).

## Architecture decisions that surprise

- **CI does NOT deploy.** GitHub Actions only validates (lint/knip/typecheck/test). Vercel auto-deploy does the rest. We tried CI-driven with `vercel build --prebuilt` and Vercel's Sensitive model doesn't allow it cleanly.
- **One Vercel project per app**, never reused. Tedious for env vars but isolates accidents — admin going down doesn't take down web.
- **No `vercel.json` except for storybook** (which needs a custom Build Command). Vercel's UI covers the common case.
- **Workspace deps via `workspace:*`.** Internal packages are imported by name (`@loyalty/db`) and resolved via Bun's workspace mechanism — no `paths` mapping in tsconfig.
- **Singleton Better Auth** in `packages/auth`. Auth lives at `/api/auth/*` in whichever app the user is in; the client uses relative URLs.
- **shadcn copy-paste, not npm dep.** Components are in the repo; you modify them directly. No fighting against a wrapper API.
- **Linear in Spanish, repo in English.** Every visible Linear surface (tickets, projects, milestones) is Spanish. Code, commits, comments, READMEs in English. The boundary friction disappears once you internalize it.

## License

Private — pilot phase. License decision deferred to post-MVP.
