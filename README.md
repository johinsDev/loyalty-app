# loyalty-app

Monorepo para CRM + programa de fidelización. Pilot inicial en local de té T4, con arquitectura multi-tenant lista para SaaS.

## Stack

- **Runtime / package manager:** Bun
- **Monorepo:** Turborepo
- **Frontend:** Next.js 15 (App Router) · React 19 · Tailwind v4
- **API:** tRPC v11 (en `packages/api`, listo para extraer a servicio standalone)
- **Auth:** Better Auth + organization plugin (multi-tenant)
- **DB:** Postgres (Neon) + Drizzle ORM
- **Background jobs / cron:** Trigger.dev v3
- **Lint:** oxlint · **Format:** oxformat (fallback temporal: `oxlint --fix`)
- **Hooks:** lefthook · **Commits:** commitlint (Conventional)
- **Dead code:** knip

## Estructura

```
apps/
  admin/          # CRM web (Next.js, puerto 3000)
  web/            # PWA cliente (Next.js, puerto 3001)
packages/
  api/            # Routers tRPC
  auth/           # Config Better Auth (server + client)
  db/             # Schema Drizzle + cliente Neon
  jobs/           # Tasks Trigger.dev
  ui/             # Componentes compartidos + estilos Tailwind
  tooling/        # tsconfig / oxlint / oxformat presets
```

## Setup

```bash
# 1. Instala dependencias
bun install

# 2. Copia env vars
cp .env.example .env
#    Llena DATABASE_URL (Neon), BETTER_AUTH_SECRET (openssl rand -base64 32),
#    TRIGGER_PROJECT_ID y TRIGGER_SECRET_KEY.

# 3. Genera y aplica migración inicial
bun run db:generate
bun run db:migrate

# 4. Arranca los dos apps
bun run dev   # admin en :3000, web en :3001
```

En otra terminal, opcional:

```bash
bun run jobs:dev   # Trigger.dev dev server
```

## Comandos

| Script | Qué hace |
|---|---|
| `bun run dev` | Levanta admin (3000) y web (3001) |
| `bun run build` | Build de todas las apps/packages |
| `bun run lint` | oxlint sobre todo el repo |
| `bun run lint:fix` | oxlint con autofix |
| `bun run format` | oxformat (formato) |
| `bun run typecheck` | tsc --noEmit en cada workspace |
| `bun run knip` | Detecta exports/deps muertos |
| `bun run db:generate` | Genera migración SQL desde el schema |
| `bun run db:migrate` | Aplica migraciones a Neon |
| `bun run db:studio` | Abre Drizzle Studio |
| `bun run jobs:dev` | Trigger.dev dev server |
| `bun run jobs:deploy` | Deploya jobs a Trigger.dev |

## Convenciones

- **Commits:** Conventional Commits (`feat(admin): ...`, `fix(db): ...`).
  Scopes válidos: `admin`, `web`, `api`, `auth`, `db`, `jobs`, `ui`, `tooling`, `ci`, `deps`, `repo`.
- **Comentarios en código:** mínimos. Sólo cuando el "porqué" no es obvio.
- **Nunca** edites `migrations/` a mano — modifica el schema y `bun run db:generate`.

## Notas / gotchas

- **oxformat** está aún en beta a mayo 2026. El script `format` lo invoca; si tu versión de oxc no lo trae, el pre-commit hook usa `oxlint --fix` como fallback.
- **Trigger.dev v3** usa Node ≥ 20 (su CLI). Bun corre todo lo demás. `node` y `bun` deben estar en `PATH`.
- **Neon HTTP driver** funciona en RSC y edge. Si necesitas transacciones largas, cambia a `@neondatabase/serverless`'s `Pool` (websocket).
- **Better Auth** comparte la instancia entre admin y web vía `packages/auth`. Si despliegas a hostnames distintos, ajusta `trustedOrigins` en `packages/auth/src/server.ts`.

## Plan de scaffold

Ver [`/Users/johan/.claude-personal/plans/empiezar-una-proyecto-con-calm-island.md`](file:///Users/johan/.claude-personal/plans/empiezar-una-proyecto-con-calm-island.md) — decisiones de arquitectura y rationale.
