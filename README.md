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
- **API:** tRPC v11 (in `packages/api`, ready to extract into a standalone service)
- **Auth:** Better Auth + organization plugin (multi-tenant)
- **DB:** Postgres (Neon) + Drizzle ORM
- **Background jobs / cron:** Trigger.dev v3
- **Observability:** Better Stack (logs + uptime + status + alerts) via `@loyalty/log`
- **WhatsApp:** `@loyalty/whatsapp` — provider-agnostic (Twilio in prod, DB outbox in preview, log/folder in dev)
- **UI:** shadcn/ui on top of Base UI primitives (`@base-ui/react`) in `packages/ui`
- **Visual docs:** Storybook 9 in `apps/storybook` (auto-deployed as a third Vercel project)
- **Lint:** oxlint · **Format:** `oxlint --fix` (oxformat once stable)
- **Hooks:** lefthook · **Commits:** commitlint (Conventional Commits)
- **Dead code:** knip
- **Tests:** vitest (unit) + Playwright (e2e, scaffolded)
- **Hosting:** Vercel (auto-deploy from Git) — one project per app
- **CI:** GitHub Actions — validate-only (lint + knip + typecheck + test). Vercel handles deploys.

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
├── db/          Drizzle ORM + Neon client + schema
├── jobs/        Trigger.dev v4 tasks
├── log/         Provider-agnostic logger (Pino + Better Stack + console + silent)
├── ui/          shadcn (Base UI) + Tailwind v4 tokens
├── whatsapp/    Provider-agnostic WhatsApp sender (Twilio + log + folder + outbox)
└── tooling/     Shared presets — tsconfig, oxlint, oxformat, vitest

.claude/skills/  Operational runbooks per area (see "Skills" below)
.github/         CI workflow + CODEOWNERS + PR template
```

## Setup

```bash
# 1. Install dependencies (Bun 1.2+ required)
bun install

# 2. Copy and fill in env vars
cp .env.example .env
#    Minimum to run the app:
#      DATABASE_URL          (Neon pooled connection string)
#      BETTER_AUTH_SECRET    (openssl rand -base64 32)
#    For jobs:
#      TRIGGER_PROJECT_ID
#      TRIGGER_SECRET_KEY
#    See .env.example — vars grouped by consumer.

# 3. Generate and apply the initial migration
bun run db:generate
bun run db:migrate

# 4. Start the apps
bun run dev   # web on :3002, admin on :3003
```

In another terminal (optional):

```bash
bun run jobs:dev                   # Trigger.dev dev server
bun --cwd apps/storybook run dev   # Storybook on :6006
```

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
| `bun run dev` | Start web (3002) + admin (3003) in parallel |
| `bun run build` | Build every app and package |
| `bun run lint` | oxlint across the whole repo (read-only) |
| `bun run lint:fix` | oxlint with autofix |
| `bun run format` | Equivalent to `lint:fix` today (oxformat once it stabilizes) |
| `bun run typecheck` | `tsc --noEmit` in every workspace |
| `bun run test` | Vitest in every package (excludes `apps/e2e`) |
| `bun run e2e` | Playwright (once specs land) |
| `bun run knip` | Dead code / unused deps / unused exports |
| `bun run db:generate` | Generate a Drizzle migration from the schema |
| `bun run db:migrate` | Apply migrations to Neon |
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
                                       # 6. merge → Vercel promotes to production
```

Direct pushes to `main` are blocked by branch protection. The full rule is in `.claude/skills/ci-cd/SKILL.md`.

## Conventions

- **Commits:** Conventional Commits (`feat(admin): ...`, `fix(db): ...`).
  Valid scopes: `admin`, `web`, `api`, `auth`, `db`, `e2e`, `jobs`, `log`, `ui`, `tooling`, `ci`, `deps`, `repo`.
- **Language:** code, comments, errors, commits, PR descriptions, and READMEs in **English**. Linear (issues, projects, milestones) in **Spanish**. User-facing copy split per locale in `messages/{es,en}.json`.
- **Code comments:** minimal. Only when the *why* isn't obvious.
- **UI components:** shadcn copy-paste model — edit the files in `packages/ui/src/components/ui/<name>.tsx` directly. Don't wrap them.
- **Never** edit `migrations/` by hand — modify the schema and run `bun run db:generate`.

## Configuration boundaries

| Variable / secret | local `.env` | Vercel project env | Trigger.dev project env |
| --- | :-: | :-: | :-: |
| `DATABASE_URL` | yes | both apps | yes |
| `BETTER_AUTH_SECRET` | yes | admin only | no |
| `BETTER_AUTH_URL` | optional override | optional override | no |
| `NEXT_PUBLIC_APP_URL` | optional override | optional override | no |
| `BETTER_STACK_SOURCE_TOKEN_<APP>` | yes (per app) | per app | per service |
| `BETTER_STACK_API_TOKEN` | yes | **no** (MCP only) | **no** |
| `SLACK_BOT_TOKEN` | yes | **no** (MCP only) | **no** |
| `TRIGGER_PROJECT_ID` / `TRIGGER_SECRET_KEY` | yes | no | yes |

`.env.example` is the canonical list with rationale per variable.

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
| `ci-cd` | Pipeline (validate-only), branch protection, opening PRs, troubleshooting |
| `vercel` | Per-project setup, env vars, Sensitive trap, MCP usage, rollback |
| `better-stack` | Logs/uptime/dashboards/alerts via BS MCP, source-token model |
| `log` | `@loyalty/log` API, channel design, adding a new transport |
| `whatsapp` | `@loyalty/whatsapp` API, four transports, outbox panel, E2E endpoint, FakeSender |
| `api-filters` | `packages/api/src/features/*` pattern — router → service → repository + composable Filters |
| `slack` | Bot setup, scopes, token rotation, debugging "not_in_channel" |
| `tooling` | oxlint + commitlint + lefthook conventions, valid scopes |
| `drizzle` / `trpc` / `next-best-practices` / `bun` / `turborepo` / `neon-postgres` | Patterns + best practices per framework |

Skills authored locally in this repo: `next-intl`, `ui`, `pwa`, `whatsapp`, `api-filters`, `ci-cd`, `vercel`, `better-stack`, `log`, `slack`, `tooling`. The rest come from the broader Claude Code skills ecosystem.

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
- **Neon HTTP driver** works in RSC and Edge runtimes. For long transactions, use `Pool` from `@neondatabase/serverless` (websocket).
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
