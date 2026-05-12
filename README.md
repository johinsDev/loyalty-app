# loyalty-app

Monorepo for a CRM + loyalty program. Pilot launches in a single T4 tea-franchise store, with a multi-tenant architecture ready to SaaS-ify.

## Stack

- **Runtime / package manager:** Bun
- **Monorepo:** Turborepo
- **Frontend:** Next.js 16 (App Router) · React 19 · Tailwind v4
- **i18n:** next-intl (es default, en second locale) in `apps/web` and `apps/admin`
- **API:** tRPC v11 (in `packages/api`, ready to extract into a standalone service)
- **Auth:** Better Auth + organization plugin (multi-tenant)
- **DB:** Postgres (Neon) + Drizzle ORM
- **Background jobs / cron:** Trigger.dev v3
- **Lint:** oxlint · **Format:** oxformat (temporary fallback: `oxlint --fix`)
- **Hooks:** lefthook · **Commits:** commitlint (Conventional)
- **Dead code:** knip

## Layout

```
apps/
  admin/          # CRM web (Next.js, port 3003)
  web/            # Customer PWA (Next.js, port 3002)
packages/
  api/            # tRPC routers
  auth/           # Better Auth config (server + client)
  db/             # Drizzle schema + Neon client
  jobs/           # Trigger.dev tasks
  log/            # Provider-agnostic logger
  ui/             # Shared components + Tailwind tokens
  tooling/        # tsconfig / oxlint / oxformat presets
```

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy env vars
cp .env.example .env
#    Fill in DATABASE_URL (Neon), BETTER_AUTH_SECRET (openssl rand -base64 32),
#    TRIGGER_PROJECT_ID, and TRIGGER_SECRET_KEY.

# 3. Generate and apply the initial migration
bun run db:generate
bun run db:migrate

# 4. Start both apps
bun run dev   # web on :3002, admin on :3003
```

Optional, in another terminal:

```bash
bun run jobs:dev   # Trigger.dev dev server
```

## i18n

`apps/web` and `apps/admin` are internationalized with **next-intl** (Spanish default, English as the second locale). Full detail lives in the `next-intl` skill (`.claude/skills/next-intl/SKILL.md`). Quick reference:

- **Locales:** `es` (default) and `en`. To add another, edit `apps/<app>/i18n/routing.ts` and create `apps/<app>/messages/<code>.json` in each app.
- **URLs:** `localePrefix: "as-needed"` → `/perfil` (es) and `/en/profile` (en). Folders under `app/[locale]/` are in English (`profile`, `card`, `customers`, `rewards`) — they're code. The `pathnames` map translates each canonical route to its per-locale public URL.
- **Language detection:** `proxy.ts` reads the `NEXT_LOCALE` cookie → `Accept-Language` header → falls back to `es`.
- **Strings:** never inline in JSX inside `app/[locale]/`. They go in `messages/{es,en}.json`.
- **Navigation:** import `Link` / `useRouter` / `usePathname` / `redirect` from `@/i18n/navigation`, **never** from `next/link` / `next/navigation`.
- **Locale switcher:** `apps/<app>/components/locale-switcher.tsx` (toggle button on top of the `@loyalty/ui` `Button`).
- **`proxy.ts`** (not `middleware.ts`): Next 16 renamed the file convention. Always use `proxy.ts`.
- **VSCode:** install the recommended **i18n Ally** extension (see `.vscode/extensions.json`) for inline translations and missing-key detection across both apps.

## Commands

| Script | What it does |
|---|---|
| `bun run dev` | Start admin (3003) and web (3002) |
| `bun run build` | Build every app and package |
| `bun run lint` | oxlint across the whole repo |
| `bun run lint:fix` | oxlint with autofix |
| `bun run format` | oxformat |
| `bun run typecheck` | `tsc --noEmit` in every workspace |
| `bun run knip` | Detect dead exports/dependencies |
| `bun run db:generate` | Generate a SQL migration from the schema |
| `bun run db:migrate` | Apply migrations to Neon |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run jobs:dev` | Trigger.dev dev server |
| `bun run jobs:deploy` | Deploy jobs to Trigger.dev |

## Conventions

- **Commits:** Conventional Commits (`feat(admin): ...`, `fix(db): ...`).
  Valid scopes: `admin`, `web`, `api`, `auth`, `db`, `e2e`, `jobs`, `log`, `ui`, `tooling`, `ci`, `deps`, `repo`.
- **Code language:** code, comments, errors, and commit messages are in English. User-facing copy lives in `apps/<app>/messages/{es,en}.json`. Linear (issues, projects, milestones) is in Spanish.
- **Comments:** minimal. Only when the *why* isn't obvious from the code.
- **Never** edit `migrations/` by hand — modify the schema and run `bun run db:generate`.

## Notes / gotchas

- **oxformat** is still in beta as of May 2026. The `format` script calls it; if your local oxc build doesn't include it, the pre-commit hook falls back to `oxlint --fix`.
- **Trigger.dev v3** requires Node ≥ 20 (its CLI). Bun runs everything else. Both `node` and `bun` must be on `PATH`.
- **Neon HTTP driver** works in RSC and edge runtimes. For long-running transactions, switch to `@neondatabase/serverless`'s websocket `Pool`.
- **Better Auth** shares one instance between admin and web via `packages/auth`. If you deploy them on different hostnames, update `trustedOrigins` in `packages/auth/src/server.ts`.

## Scaffold plan

See [`/Users/johan/.claude-personal/plans/empiezar-una-proyecto-con-calm-island.md`](file:///Users/johan/.claude-personal/plans/empiezar-una-proyecto-con-calm-island.md) — architecture decisions and rationale.
