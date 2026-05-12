# CLAUDE.md — agent guide for loyalty-app

This file is the entry point for AI agents (Claude Code, Cursor, etc.) working in this repo. Humans should read `README.md` first.

## What this repo is

Multi-tenant CRM + loyalty-card platform. The first pilot runs in a single T4 tea-franchise store; the architecture is built so the same codebase can SaaS-ify when validated. Two user-facing apps share one tRPC API, one auth surface, one DB schema.

## Stack snapshot

- **Runtime / pkg mgr:** Bun
- **Monorepo:** Turborepo
- **Frontend:** Next.js 15 (App Router) · React 19 · Tailwind v4
- **API:** tRPC v11 in `packages/api`
- **Auth:** Better Auth + organization plugin (multi-tenant)
- **DB:** Postgres (Neon) + Drizzle ORM
- **Jobs / cron:** Trigger.dev v3
- **Logger:** `@loyalty/log` (Pino-backed, swappable channels)
- **i18n:** **next-intl** in `apps/web` and `apps/admin`. See the `next-intl` skill.
- **Lint / format / commits:** oxlint · oxformat · commitlint (Conventional) · lefthook
- **Deploy:** Vercel auto-deploys on merge to `main`

## Monorepo layout

```
apps/
  admin/      # CRM web (port 3000) — Spanish, internal
  web/        # Customer PWA (port 3002) — Spanish + English via next-intl
packages/
  api/        # tRPC routers
  auth/       # Better Auth server + client
  db/         # Drizzle schema + Neon client
  jobs/       # Trigger.dev tasks
  log/        # Provider-agnostic logger
  ui/         # Shared components + Tailwind tokens
  tooling/    # tsconfig / oxlint / oxformat presets
```

## Workflow

- **PR-only:** `main` is protected; every change goes through a PR. Vercel deploys on merge. CI runs lint + typecheck + build.
- **Commits:** Conventional Commits. Scopes: `admin`, `web`, `api`, `auth`, `db`, `e2e`, `jobs`, `log`, `ui`, `tooling`, `ci`, `deps`, `repo`. Subject in lowercase, imperative mood.
- **Worktrees:** Feature branches run in `.claude/worktrees/*` via the native `EnterWorktree` tool. Don't `git worktree add` manually.
- **Plans:** Non-trivial work goes through plan-mode before implementation.

## Language conventions

- **Code, comments, errors, commits, file names:** English.
- **Linear (issues, projects, milestones):** Spanish — the product owner reads it.
- **User-facing copy:** lives in `apps/web/messages/{es,en}.json` and `apps/admin/messages/{es,en}.json` (next-intl). Never hardcode in JSX inside `app/[locale]/`. Default locale is Spanish; English is the second locale.

## i18n — the rules

This is the most error-prone area for agents; read the `next-intl` skill before touching anything under `apps/*/app/[locale]/`. TL;DR:

- **Never import from `next/link` or `next/navigation`** inside `apps/*/app/[locale]/**` or `apps/*/components/**`. Use `@/i18n/navigation` instead. (`notFound` from `next/navigation` is fine — it's locale-agnostic.)
- **Every page and layout that calls `getTranslations` must call `setRequestLocale(locale)` first** — otherwise static rendering breaks silently.
- **`generateMetadata` always passes `locale` explicitly** to `getTranslations`.
- **Add new locales by editing `apps/<app>/i18n/routing.ts` + creating `messages/<code>.json`** in BOTH apps — no other code changes needed.
- **Folder names under `app/[locale]/` are in English** (`profile`, `card`, `customers`, `rewards`) — they're code. The visible URL is translated per locale via `pathnames`. `<Link href="...">` always takes the canonical English route key.
- **The request-interception file is `proxy.ts`** (Next 16 renamed `middleware.ts`). Don't create `middleware.ts` — Next 16 still recognizes it but it's deprecated and will be removed.
- **`/offline`, `/api/*`, `/sw.js`, `/manifest.webmanifest`** are locale-agnostic and excluded from the middleware matcher.

## UI conventions

- `@loyalty/ui` is the shared component package. Components live as flat files in `packages/ui/src/` and are edited in place (shadcn-style copy-paste). **Never wrap a primitive in a one-off wrapper** — extend the primitive itself if it needs a new variant.
- Stories live in `apps/storybook` (when present) — add one for every new primitive.
- App-specific composites (`LocaleSwitcher`, `InstallPrompt`) live in `apps/<app>/components/`, not in `@loyalty/ui`.

## Available skills

Run `Skill` with one of these names when the situation matches its description:

- `next-intl` — i18n setup, server vs client patterns, locale switching, adding locales
- `pwa` — offline page, service worker, install prompt, manifest icons
- `tooling` — oxlint / oxformat / commitlint / lefthook; "why did pre-commit reject me"
- `ci-cd` — GitHub Actions, branch protection, Vercel auto-deploy
- `vercel` — adding apps to Vercel, env vars, debugging builds
- `better-stack` — logs, uptime, status pages, alerts (via MCP)
- `slack` — Slack MCP setup, scopes, bot install
- `log` — `@loyalty/log` usage, transports, fake mode for tests
- `drizzle` / `neon-postgres` — schema, migrations, query patterns
- `better-auth-best-practices` — auth config, session, plugins
- `turborepo` / `bun` — monorepo build pipeline, task graph
- `next-best-practices` / `next-cache-components` / `vercel-react-best-practices` — Next.js patterns
- `web-design-guidelines` — UI review against WIG

## Files an agent should not edit casually

- `migrations/` — generated. Edit the Drizzle schema and run `bun run db:generate`.
- `messages/<locale>.json` for any locale **except by editing all locales in parallel** — diverging shapes break i18n-ally.
- `.env*` — local-only; never commit secrets.
- `turbo.json`, `tsconfig.*` at the root — coordinate with the `turborepo` / `tooling` skills first.

## When unsure

- Read the relevant skill before grepping the codebase.
- Open a plan (plan mode) before any cross-package change.
- If the task involves the i18n surface, default to "use the existing patterns" — don't introduce a second locale-resolution path.
