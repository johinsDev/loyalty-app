# loyalty-app

Monorepo para CRM + programa de fidelización. Pilot inicial en local de té T4, con arquitectura multi-tenant lista para SaaS.

> **Status:** MVP en desarrollo activo. PWA cliente, CRM admin, observabilidad, CI/CD, deploy pipeline, biblioteca de UI y docs visuales ya conectados. El siguiente milestone es la lógica de dominio (puntos, canjes, KPIs).

Para una sesión de Claude Code: empezá por [`CLAUDE.md`](./CLAUDE.md). Las convenciones operacionales viven en [`.claude/skills/<area>/SKILL.md`](./.claude/skills/).

## Stack

- **Runtime / package manager:** Bun 1.2
- **Monorepo:** Turborepo 2
- **Frontend:** Next.js 15 (App Router) · React 19 · Tailwind v4
- **PWA:** `@serwist/next` (instalable, offline-tolerant)
- **API:** tRPC v11 (en `packages/api`, listo para extraer a servicio standalone)
- **Auth:** Better Auth + organization plugin (multi-tenant)
- **DB:** Postgres (Neon) + Drizzle ORM
- **Background jobs / cron:** Trigger.dev v3
- **Observabilidad:** Better Stack (logs + uptime + status + alertas) vía `@loyalty/log`
- **UI:** shadcn/ui sobre Base UI primitives (`@base-ui/react`) en `packages/ui`
- **Docs visuales:** Storybook 9 en `apps/storybook` (deploy auto como tercer proyecto Vercel)
- **Lint:** oxlint · **Format:** `oxlint --fix` (oxformat cuando estabilice)
- **Hooks:** lefthook · **Commits:** commitlint (Conventional Commits)
- **Dead code:** knip
- **Tests:** vitest (unit) + Playwright (e2e, scaffolded)
- **Hosting:** Vercel (auto-deploy desde Git) — un proyecto por app
- **CI:** GitHub Actions — validate-only (lint + knip + typecheck + test). El deploy lo hace Vercel.

## Estructura

```
apps/
├── web/         PWA cliente — instalable, offline-tolerant (Next 15, puerto 3002)
├── admin/       CRM staff — gestión de tenant, dashboards (Next 15, puerto 3003)
├── storybook/   Docs visuales de @loyalty/ui (Storybook 9, puerto 6006)
└── e2e/         Suite Playwright (scaffold; specs a venir)

packages/
├── api/         Routers tRPC v11
├── auth/        Better Auth (server + client, plugin organization)
├── db/          Drizzle ORM + cliente Neon + schema
├── jobs/        Tasks Trigger.dev v3
├── log/         Logger provider-agnostic (Pino + Better Stack + console + silent)
├── ui/          shadcn (Base UI) + tokens Tailwind v4
└── tooling/     Presets compartidos — tsconfig, oxlint, oxformat, vitest

.claude/skills/  Runbooks operacionales por área (ver "Skills" abajo)
.github/         CI workflow + CODEOWNERS + PR template
```

## Setup

```bash
# 1. Instala dependencias (Bun 1.2+ requerido)
bun install

# 2. Copia y completa env vars
cp .env.example .env
#    Mínimo para correr la app:
#      DATABASE_URL          (connection string pooled de Neon)
#      BETTER_AUTH_SECRET    (openssl rand -base64 32)
#    Para jobs:
#      TRIGGER_PROJECT_ID
#      TRIGGER_SECRET_KEY
#    Ver .env.example — vars agrupadas por consumidor.

# 3. Genera y aplica la migración inicial
bun run db:generate
bun run db:migrate

# 4. Arranca las apps
bun run dev   # web en :3002, admin en :3003
```

En otra terminal (opcional):

```bash
bun run jobs:dev                   # Trigger.dev dev server
bun --cwd apps/storybook run dev   # Storybook en :6006
```

## Comandos

| Script | Qué hace |
|---|---|
| `bun run dev` | Levanta web (3002) + admin (3003) en paralelo |
| `bun run build` | Build de todas las apps/packages |
| `bun run lint` | oxlint sobre todo el repo (read-only) |
| `bun run lint:fix` | oxlint con autofix |
| `bun run format` | Equivalente a `lint:fix` hoy (oxformat cuando estabilice) |
| `bun run typecheck` | `tsc --noEmit` en cada workspace |
| `bun run test` | Vitest en cada package (excluye `apps/e2e`) |
| `bun run e2e` | Playwright (cuando aterricen specs) |
| `bun run knip` | Dead code / unused deps / unused exports |
| `bun run db:generate` | Genera migración Drizzle desde el schema |
| `bun run db:migrate` | Aplica migraciones a Neon |
| `bun run db:studio` | Abre Drizzle Studio |
| `bun run jobs:dev` | Trigger.dev dev server |
| `bun run jobs:deploy` | Deploya jobs a Trigger.dev cloud |
| `bun --cwd apps/storybook run dev` | Storybook local (puerto 6006) |
| `bun --cwd apps/storybook run build` | Build estático de Storybook (`storybook-static/`) |
| `bun run clean` | Limpia `.next`, `.turbo`, `node_modules` en todos lados |

## Cómo llega el código a producción

```
git checkout -b feat/<nombre>          # 1. branch desde main
… editar, commit …                     #    (Conventional Commits con commitlint)
git push -u origin feat/<nombre>      # 2. push
gh pr create                           # 3. abrís PR (template auto-rellenado)
                                       # 4. CI corre el job `validate`
                                       #    (lint + knip + typecheck + test)
                                       # 5. Vercel auto-deploya las 3 apps
                                       #    a URLs preview (comentadas en el PR)
                                       # 6. merge → Vercel promueve a producción
```

Direct pushes a `main` están bloqueados por branch protection. La regla full está en `.claude/skills/ci-cd/SKILL.md`.

## Convenciones

- **Commits:** Conventional Commits (`feat(admin): ...`, `fix(db): ...`).
  Scopes válidos: `admin`, `web`, `api`, `auth`, `db`, `e2e`, `jobs`, `log`, `ui`, `tooling`, `ci`, `deps`, `repo`.
- **Idioma:** código, comentarios, errores, commits, PR descriptions y READMEs en **inglés**. Linear (issues, projects, milestones) en **español**.
- **Comentarios en código:** mínimos. Sólo cuando el "porqué" no es obvio.
- **Componentes UI:** shadcn copy-paste model — edita los archivos en `packages/ui/src/components/ui/<name>.tsx` directamente. No los envuelvas en wrappers.
- **Nunca** edites `migrations/` a mano — modifica el schema y `bun run db:generate`.

## Boundaries de configuración

| Variable / secret | `.env` local | Vercel project env | Trigger.dev project env |
| --- | :-: | :-: | :-: |
| `DATABASE_URL` | sí | ambas apps | sí |
| `BETTER_AUTH_SECRET` | sí | sólo admin | no |
| `BETTER_AUTH_URL` | override opcional | override opcional | no |
| `NEXT_PUBLIC_APP_URL` | override opcional | override opcional | no |
| `BETTER_STACK_SOURCE_TOKEN_<APP>` | sí (por app) | por app | por servicio |
| `BETTER_STACK_API_TOKEN` | sí | **no** (sólo MCP) | **no** |
| `SLACK_BOT_TOKEN` | sí | **no** (sólo MCP) | **no** |
| `TRIGGER_PROJECT_ID` / `TRIGGER_SECRET_KEY` | sí | no | sí |

`.env.example` es la lista canónica con rationale por variable.

### Por qué `NEXT_PUBLIC_APP_URL` y `BETTER_AUTH_URL` son opcionales

`apps/{web,admin}/lib/app-url.ts` tiene un helper `getAppUrl()` que va en cascada:

```
browser  → window.location.origin
server   → env explícito > VERCEL_URL (auto-inyectado por Vercel) > localhost:300{2,3}
```

Sólo se setean explícitamente cuando hay custom domain en prod, o para testing cross-app de auth en preview.

## Observabilidad

Una sola superficie de logger (`@loyalty/log`), múltiples sinks elegidos en runtime.

- **Channels disponibles:** `pino`, `console`, `silent`, `better-stack`.
- **Activación automática:** si `BETTER_STACK_SOURCE_TOKEN_*` está seteado, el bootstrap usa `better-stack`. Sino, `pino` en dev.
- **Sources separados por servicio:** web, admin, jobs cada uno con su ingest dedicado.
- **Uptime monitors:** Better Stack polea `/api/health` en web + admin cada 3 min. Failures escalan a Slack `#alerts-loyalty`.
- **Alertas:** chart-alerts sobre niveles de log (ej. spike de errors) + uptime, routed a Slack.

Operación día-a-día vía Better Stack MCP (registrado en `.mcp.json`). Ver `.claude/skills/better-stack/SKILL.md`.

## PWA (apps/web)

La app cliente ships como PWA instalable.

- Manifest en `/manifest.webmanifest` (declarado en `apps/web/app/manifest.ts`).
- Service worker en `/sw.js`, generado por `@serwist/next` desde `apps/web/app/sw.ts`.
- Página offline en `/offline`.
- `<InstallPrompt />` captura `beforeinstallprompt` y ofrece Add-to-Home-Screen donde el browser lo soporta.
- Cache strategy:
  - `_next/static/*` → cache-first (TTL largo).
  - Páginas HTML → network-first, fallback a `/offline`.
  - `/api/*`, `/trpc/*` → **no cacheado** (auth-bound, user-scoped).
  - Imágenes → cache-first (30-day TTL).
- PWA está **deshabilitada en dev** para que HMR funcione. Build + start para probar PWA local.

Deep dive: `.claude/skills/pwa/SKILL.md`.

## UI library (apps/storybook + packages/ui)

`@loyalty/ui` expone todos los componentes shadcn/ui con primitives de **Base UI** (`@base-ui/react`), no Radix. ~55 componentes copiados al repo — vos los editás en `packages/ui/src/components/ui/<name>.tsx`.

- **Tokens de theme** en `packages/ui/styles/globals.css` (oklch, neutral base, brand verde T4 placeholder hasta el brand kit).
- **Dark mode** vía clase `.dark` en `<html>`.
- **Stories** en `apps/storybook/stories/<name>.stories.tsx` (CSF 3, una por componente, con autodocs).
- **Storybook deploy:** Vercel project `loyalty-app-storybook`, auto-deploy desde `main`, preview por PR.

Para agregar un componente: `bunx shadcn@latest add <name>` desde `packages/ui`, después patch `@/cn` → `../../cn` y agregar al barrel.

Deep dive: `.claude/skills/ui/SKILL.md`.

## Skills (runbooks en el repo)

`.claude/skills/<area>/SKILL.md` — referencia canónica por área operacional. Escritos para Claude Code y teammates.

| Skill | Cubre |
| --- | --- |
| `ui` | Component library, Base UI primitives, theme tokens, dark mode, Storybook |
| `pwa` | Install/offline, cache strategy, refresh de icons + brand, Lighthouse, gotchas |
| `ci-cd` | Pipeline (validate-only), branch protection, abrir PRs, troubleshooting |
| `vercel` | Setup por proyecto, env vars, trap de Sensitive, MCP usage, rollback |
| `better-stack` | Logs/uptime/dashboards/alerts vía BS MCP, modelo de source tokens |
| `log` | API `@loyalty/log`, diseño de channels, agregar un nuevo transport |
| `slack` | Bot setup, scopes, rotación de token, debug "not_in_channel" |
| `tooling` | oxlint + commitlint + lefthook conventions, scopes válidos |
| `drizzle` / `trpc` / `next-best-practices` / `bun` / `turborepo` / `neon-postgres` | Patterns + best practices por framework |

Skills locales del repo: `ui`, `pwa`, `ci-cd`, `vercel`, `better-stack`, `log`, `slack`, `tooling`. El resto viene del ecosistema general de Claude Code skills.

## MCP servers

Cableados en `.mcp.json` para uso desde Claude Code:

| Server | Surface | Notas |
| --- | --- | --- |
| `linear-server` | HTTP, OAuth | Tickets, proyectos, milestones (todo en español) |
| `vercel` | HTTP, OAuth | Read-only sobre projects, deployments, runtime + build logs |
| `better-stack` | HTTP, bearer | Uptime API (monitors, status pages, incidents) |
| `better-stack-telemetry` | HTTP, bearer | Telemetry API (sources, dashboards, charts, alerts) |
| `slack` | stdio (`@modelcontextprotocol/server-slack`) | Postea mensajes, reacciones, channel history |

Los tokens viven en `.env`. Los servers HTTP no leen `.env` directo — el repo trae un `.envrc` que direnv sourcea al shell para que Claude Code resuelva `${VAR}` al handshake.

## Gotchas comunes de dev local

- **Trigger.dev v3 necesita Node ≥ 20** (su CLI). Bun corre todo lo demás. Ambos en `$PATH`.
- **Neon HTTP driver** funciona en RSC y Edge. Para transacciones largas, usa `Pool` de `@neondatabase/serverless` (websocket).
- **Better Auth `trustedOrigins`** se deriva dinámicamente de `VERCEL_URL` + overrides explícitos (ver `packages/auth/src/server.ts`). Cross-app auth en preview deploys requiere `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` seteados explícitamente — los previews de admin y web tienen diferente `VERCEL_URL`.
- **Service worker deshabilitado en dev** — set en `apps/web/next.config.ts` para no pelear con HMR. Build + start para probar PWA local.
- **Sensitive env vars en Vercel** — Vercel no las devuelve por `vercel pull`. Mark Plain Text para cualquier var que el build necesite leer en compile time. Full explainer en `.claude/skills/vercel/SKILL.md`.
- **`@/cn` aliases sólo en packages/ui** — los componentes shadcn instalados por el CLI escriben `@/cn` que sólo resuelve dentro de packages/ui. Patch a paths relativos cuando agregás nuevos componentes (ver skill `ui`).

## Decisiones de arquitectura que sorprenden

- **CI NO deploya.** GitHub Actions sólo valida (lint/knip/typecheck/test). Vercel auto-deploy hace el resto. Probamos CI-driven con `vercel build --prebuilt` y el modelo Sensitive de Vercel no lo permite limpio.
- **Un proyecto Vercel por app**, nunca reutilizados. Tedioso para env vars pero aísla accidentes — admin caído no se lleva web.
- **Sin `vercel.json` salvo para storybook** (que necesita Build Command custom). El UI de Vercel cubre el caso común.
- **Workspace deps via `workspace:*`**. Internal packages se importan por nombre (`@loyalty/db`) y resuelven vía workspaces de Bun — sin `paths` mapping en tsconfig.
- **Singleton Better Auth** en `packages/auth`. Auth vive en `/api/auth/*` en cualquier app donde el user esté; el client usa URLs relativas.
- **shadcn copy-paste, no npm dep.** Los componentes están en el repo; los modificás directo. No te peleás contra una API de wrappers.
- **Linear en español, repo en inglés.** Cada superficie visible de Linear (tickets, projects, milestones) en español. Código, commits, comments, READMEs en inglés. La fricción del boundary desaparece cuando lo internalizás.

## Licencia

Privado — fase pilot. Decisión de licencia diferida a post-MVP.
