# loyalty-app — Claude Code briefing

Multi-tenant CRM and loyalty program. Live pilot in a single T4 tea franchise; the architecture supports going SaaS without a rewrite.

Stack one-liner: **Bun + Turborepo + Next 16 (App Router) + tRPC v11 + Better Auth + Drizzle + Neon Postgres + Trigger.dev v3 + Better Stack + Vercel auto-deploy + @serwist/next PWA + shadcn (Base UI) + Storybook 9 + next-intl (es/en).**

---

## Repo map

```
apps/
├── web/         Customer PWA — installable, offline-tolerant (Next 16, port 3002)
├── admin/       Staff CRM — tenant management, dashboards (Next 16, port 3003)
├── storybook/   Visual docs for @loyalty/ui (Storybook 9, port 6006)
└── e2e/         Playwright suite (scaffold, specs to come)

packages/
├── api/         tRPC v11 routers (consumed by web + admin)
├── auth/        Better Auth (server + client, organization plugin = multi-tenant)
├── cache/       Provider-agnostic cache (Upstash + memory + ioredis)
├── db/          Drizzle ORM + Neon Postgres client + schema
├── email/       Provider-agnostic email sender (Resend + log + folder + outbox)
├── email-templates/  React Email + Tailwind layouts + WelcomeEmail
├── jobs/        Trigger.dev v4 background tasks
├── log/         Provider-agnostic logger (Pino + Better Stack + console + silent)
├── push/        Provider-agnostic push notifications (Web Push + Expo + log + outbox)
├── realtime/    Real-time channel (publisher + React hook) backed by partykit/
├── sms/         Provider-agnostic SMS sender (Twilio + log + folder + outbox)
├── ui/          shadcn (Base UI) component library + Tailwind v4 tokens
├── whatsapp/    Provider-agnostic WhatsApp sender (Twilio + log + folder + outbox)
└── tooling/     Shared tsconfig / oxlint / oxformat / vitest presets

partykit/       Cloudflare Workers + Durable Objects deploy (real-time party server)
```

---

## Where to look

| For… | Look at |
| --- | --- |
| End-to-end onboarding | `README.md` |
| Convention runbooks | `.claude/skills/<area>/SKILL.md` (full list below) |
| Commit scopes | `commitlint.config.ts` |
| Env vars (every one + where it goes) | `.env.example` |
| CI workflow | `.github/workflows/ci.yml` |
| PR template | `.github/PULL_REQUEST_TEMPLATE.md` |

---

## Hard rules

These have come up enough that they're load-bearing — break them and something breaks:

- **PR-only on `main`.** Branch protection blocks direct pushes. Every change opens `gh pr create`, even tiny ones. The `validate` CI check is required.
- **CI validates, Vercel deploys.** GitHub Actions runs lint + knip + typecheck + test. Vercel's Git integration handles all deploys for `loyalty-app-web`, `loyalty-app-admin`, and `loyalty-app-storybook`.
- **English in repo, Spanish only in Linear and in `messages/es.json`.** Code, comments, errors, commits, PR descriptions, READMEs, skills → English. Visible Linear surfaces (issues, projects, milestones, labels) → Spanish. User-facing copy is split per locale in `apps/<app>/messages/{es,en}.json`.
- **Default to writing no comments.** Add one only when the *why* is non-obvious.
- **Never hand-edit DB migrations.** Change the Drizzle schema, then `bun run db:generate`.
- **shadcn copy-paste model.** Components in `packages/ui/src/components/ui/<name>.tsx` are *yours* — modify them directly. Don't wrap them in another abstraction layer.

---

## i18n rules

Most error-prone area for agents. Read the `next-intl` skill before touching anything under `apps/*/app/[locale]/`. TL;DR:

- **Never import from `next/link` or `next/navigation`** inside `apps/*/app/[locale]/**` or `apps/*/components/**`. Use `@/i18n/navigation` instead. (`notFound` from `next/navigation` is fine — it's locale-agnostic.)
- **Every page and layout that calls `getTranslations` must call `setRequestLocale(locale)` first** — otherwise static rendering breaks silently.
- **`generateMetadata` always passes `locale` explicitly** to `getTranslations`.
- **Add new locales by editing `apps/<app>/i18n/routing.ts` + creating `messages/<code>.json`** in BOTH apps — no other code changes needed.
- **Folder names under `app/[locale]/` are in English** (`profile`, `card`, `customers`, `rewards`) — they're code. The visible URL is translated per locale via `pathnames`. `<Link href="...">` always takes the canonical English route key.
- **The request-interception file is `proxy.ts`** (Next 16 renamed `middleware.ts`). Don't create `middleware.ts` — it's deprecated and will be removed.
- **`/offline`, `/api/*`, `/sw.js`, `/manifest.webmanifest`** are locale-agnostic and excluded from the proxy matcher.

---

## Common tasks → which skill

| Goal | Skill |
| --- | --- |
| New feature in apps/{web,admin}: where to put files, screen vs feature, no deep barrels | `architecture-guard` |
| i18n: add a locale, translate a route, fix a `next/link` import | `next-intl` |
| Add / tweak a UI component, brand colors, dark mode, Storybook | `ui` |
| Build, install, or debug the PWA (sw, manifest, install prompt) | `pwa` |
| Anything CI: failing run, branch protection, opening a PR | `ci-cd` |
| Vercel deploy targets, env vars, Sensitive trap, rollback | `vercel` |
| Logs, dashboards, uptime monitors, alerts (Better Stack) | `better-stack` |
| `@loyalty/log` API, adding a new transport | `log` |
| Send a WhatsApp message, add a strategy, debug outbox / Twilio | `whatsapp` |
| Send an SMS, add a strategy, debug segments, view outbox | `sms` |
| Cache a query, invalidate, add a provider (upstash/redis/memory) | `cache` |
| Send an email, author a React Email template, debug Resend / outbox | `email` |
| Send a push (web + Expo), register a device token, debug outbox | `push` |
| Real-time events via PartyKit, add a party, debug WebSocket | `realtime` |
| Slack bot setup, scopes, posting from MCP | `slack` |
| Commit scopes, oxlint, lefthook, commitlint | `tooling` |
| Drizzle migrations, Neon, tRPC patterns, Next 16 patterns | `drizzle`, `neon-postgres`, `trpc`, `next-best-practices` |

Skills authored locally for this repo: `architecture-guard`, `next-intl`, `ui`, `pwa`, `whatsapp`, `sms`, `cache`, `email`, `push`, `realtime`, `api-filters`, `ci-cd`, `vercel`, `better-stack`, `log`, `slack`, `tooling`. The rest are framework references from the broader Claude Code skills ecosystem.

---

## Things newcomers (or future you) might assume wrongly

- **Components are NOT npm deps.** `@loyalty/ui` ships shadcn components copied into the repo. To "upgrade" Button, edit `packages/ui/src/components/ui/button.tsx`. Don't `bunx shadcn add button --reinstall` and expect the old customizations to survive — review the diff manually.
- **`@/cn` and `@/components/ui/*` aliases only work inside `packages/ui`.** When CLI-installed components arrive, their `@/` imports get rewritten to relative paths so consumer apps (which have their own `@/` aliasing) resolve correctly. See the `ui` skill for the sed pattern.
- **`NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` are optional.** `apps/{web,admin}/src/lib/app-url.ts` derives the URL from `VERCEL_URL` automatically. Set them explicitly only for custom domains or cross-app preview testing.
- **`apps/{web,admin}` use a `src/` layout.** Everything except `app/` (routes) lives under `src/{lib,components,i18n,features,env.ts}`. The `@/*` alias resolves to `./src/*`. See `.claude/skills/architecture-guard/SKILL.md`.
- **Sensitive env vars in Vercel.** Marked Sensitive = not returned by `vercel pull`, not readable to builds running outside Vercel. Keep build-time vars (DATABASE_URL etc.) as Plain Text.
- **The web app's service worker is disabled in dev** so HMR works. Build + start (or check on a preview deploy) to exercise PWA behavior.
- **Toast is `sonner`, not `Toast`.** Base UI doesn't ship a Toast primitive; we use `sonner` instead. There's a `<Toaster />` you mount once and `toast(...)` to call from anywhere.
- **Next 16 renders dynamic by default.** Pages under `app/[locale]/` are server-rendered on demand unless you opt into `cacheComponents: true` + `"use cache"` directives. This is fine for an auth-aware app — most pages need to be dynamic anyway.

---

## Quick reference — common commands

```bash
bun run dev                              # web (3002) + admin (3003)
bun --cwd apps/storybook run dev         # Storybook (6006)
bun run lint && bun run typecheck && bun run test  # full validate suite locally
bun run db:generate && bun run db:migrate          # DB schema change → migration
bunx shadcn@latest add <component>       # add a new UI component to packages/ui
gh pr create --fill-first                # PR with auto-filled title from commits
```
