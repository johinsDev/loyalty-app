# loyalty-app — Claude Code briefing

Multi-tenant CRM and loyalty program. Live pilot in a single T4 tea franchise; the architecture supports going SaaS without a rewrite.

Stack one-liner: **Bun + Turborepo + Next 15 (App Router) + tRPC v11 + Better Auth + Drizzle + Neon Postgres + Trigger.dev v3 + Better Stack + Vercel auto-deploy + @serwist/next PWA + shadcn (Base UI) + Storybook 9.**

---

## Repo map

```
apps/
├── web/         Customer PWA — installable, offline-tolerant (Next 15, port 3002)
├── admin/       Staff CRM — tenant management, dashboards (Next 15, port 3003)
├── storybook/   Visual docs for @loyalty/ui (Storybook 9, port 6006)
└── e2e/         Playwright suite (scaffold, specs to come)

packages/
├── api/         tRPC v11 routers (consumed by web + admin)
├── auth/        Better Auth (server + client, organization plugin = multi-tenant)
├── db/          Drizzle ORM + Neon Postgres client + schema
├── jobs/        Trigger.dev v3 background tasks
├── log/         Provider-agnostic logger (Pino + Better Stack + console + silent)
├── ui/          shadcn (Base UI) component library + Tailwind v4 tokens
└── tooling/     Shared tsconfig / oxlint / oxformat / vitest presets
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
- **English in repo, Spanish only in Linear.** Code, comments, errors, commits, PR descriptions, READMEs, skills → English. Visible Linear surfaces (issues, projects, milestones, labels) → Spanish.
- **Default to writing no comments.** Add one only when the *why* is non-obvious.
- **Never hand-edit DB migrations.** Change the Drizzle schema, then `bun run db:generate`.
- **shadcn copy-paste model.** Components in `packages/ui/src/components/ui/<name>.tsx` are *yours* — modify them directly. Don't wrap them in another abstraction layer.

---

## Common tasks → which skill

| Goal | Skill |
| --- | --- |
| Add / tweak a UI component, brand colors, dark mode, Storybook | `ui` |
| Build, install, or debug the PWA (sw, manifest, install prompt) | `pwa` |
| Anything CI: failing run, branch protection, opening a PR | `ci-cd` |
| Vercel deploy targets, env vars, Sensitive trap, rollback | `vercel` |
| Logs, dashboards, uptime monitors, alerts (Better Stack) | `better-stack` |
| `@loyalty/log` API, adding a new transport | `log` |
| Slack bot setup, scopes, posting from MCP | `slack` |
| Commit scopes, oxlint, lefthook, commitlint | `tooling` |
| Drizzle migrations, Neon, tRPC patterns, Next 15 patterns | `drizzle`, `neon-postgres`, `trpc`, `next-best-practices` |

Skills authored locally for this repo: `ui`, `pwa`, `ci-cd`, `vercel`, `better-stack`, `log`, `slack`, `tooling`. The rest are framework references from the broader Claude Code skills ecosystem.

---

## Things newcomers (or future you) might assume wrongly

- **Components are NOT npm deps.** `@loyalty/ui` ships shadcn components copied into the repo. To "upgrade" Button, edit `packages/ui/src/components/ui/button.tsx`. Don't `bunx shadcn add button --reinstall` and expect the old customizations to survive — review the diff manually.
- **`@/cn` and `@/components/ui/*` aliases only work inside `packages/ui`.** When CLI-installed components arrive, their `@/` imports get rewritten to relative paths so consumer apps (which have their own `@/` aliasing) resolve correctly. See the `ui` skill for the sed pattern.
- **`NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` are optional.** `apps/{web,admin}/lib/app-url.ts` derives the URL from `VERCEL_URL` automatically. Set them explicitly only for custom domains or cross-app preview testing.
- **Sensitive env vars in Vercel.** Marked Sensitive = not returned by `vercel pull`, not readable to builds running outside Vercel. Keep build-time vars (DATABASE_URL etc.) as Plain Text.
- **The web app's service worker is disabled in dev** so HMR works. Build + start (or check on a preview deploy) to exercise PWA behavior.
- **Toast is `sonner`, not `Toast`.** Base UI doesn't ship a Toast primitive; we use `sonner` instead. There's a `<Toaster />` you mount once and `toast(...)` to call from anywhere.

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
