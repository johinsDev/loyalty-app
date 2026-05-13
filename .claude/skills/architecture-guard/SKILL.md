---
name: architecture-guard
description: How the Next.js apps in this repo are laid out — feature-driven `src/features/<name>/`, dumb screens in `app/`, shared infra in `src/lib/`. Use when adding a new page, moving business logic out of an `app/**` file, structuring a feature with its own components / api / state, or reviewing a PR for architectural drift. Lifted from WeMetVia's architecture-guard and adapted from Expo Router to Next.js App Router.
---

# Architecture guard — feature-driven Next.js

You are a senior Next.js engineer working on a multi-app Turborepo monorepo. Your goal is to keep `apps/web` and `apps/admin` performant, feature-driven, and easy to navigate as they grow. The rules below are how this repo expresses that intent.

---

## 1. Architectural philosophy (feature-driven)

Never put business logic, data fetching, or non-trivial UI inside `app/`. The `app/` directory is **strictly for routing** (route files, layouts, route handlers).

All domain logic, UI, state, and helpers live inside `src/features/<feature>/` or `src/lib/`.

**Directory layout** (per app — `apps/web/`, `apps/admin/`):

```
app/                          Next.js App Router files only.
  [locale]/
    layout.tsx                Routing shell + providers, no UI.
    page.tsx                  Dumb screen → renders a Feature component.
    <segment>/page.tsx        Dumb screen.
  api/                        Route handlers (POST /api/x, etc).

src/
  lib/                        Third-party clients, env, framework glue.
    trpc/                       tRPC server/client setup.
    log.ts                      LogManager instance for this app.
    app-url.ts                  Derives the public origin.
    pwa.ts                      (web only) install-prompt + standalone detection.
  components/                 App-wide UI not specific to one feature.
    locale-switcher.tsx
    install-prompt.tsx
  i18n/                       next-intl routing + request config.
  features/<feature>/
    components/               Feature-specific UI (RSC + client).
    api/                      tRPC hook wrappers / fetchers (client side).
    lib/                      Feature-only helpers (parsers, gates).
    schema/                   Zod schemas for forms / local validation.
    store/                    Zustand slices (when client state is needed).
  env.ts                      t3-env validated env. Side-effecting on import.
```

`@loyalty/ui` already holds the shadcn primitives — **don't duplicate them** inside an app. Feature components compose shadcn pieces from `@loyalty/ui`.

### The same rule applies on the backend

Feature-grouping is not a frontend-only convention. **The tRPC API in `packages/api/` follows the same shape** — every new domain (whatsapp-outbox, sms-outbox, customers, rewards, …) lives in its own folder under `packages/api/src/features/<feature>/`:

```
packages/api/src/features/<feature>/
├── schemas.ts          zod inputs + exported types
├── filters.ts          composable filter class (when the list endpoint filters)
├── repository.ts       the ONLY file in the feature that touches Drizzle
├── service.ts          business rules — throws TRPCError, masks fields, etc.
├── router.ts           tRPC procedures, thin
└── index.ts            barrel that re-exports the router only
```

When you add an outbound channel (SMS, WhatsApp, push, email) the *package* lives in `packages/<channel>/` (strategy pattern with transports), the *table* lives in `packages/db/src/schema/<channel>-outbox.ts`, and the *API surface* — list + get + filters + the dev view's tRPC backend — lives in `packages/api/src/features/<channel>-outbox/`. Reference: `packages/api/src/features/{whatsapp,sms}-outbox/` and the `api-filters` skill for the layering rules.

Don't put domain queries inline in a tRPC router. Don't put Drizzle calls in a Next.js route handler — delegate to the tRPC caller (`trpc()` from `apps/<app>/src/lib/trpc/server.ts`), which routes through the same router → service → repository chain. Route handlers under `apps/<app>/app/api/` exist only for HTTP-shaped concerns (E2E hooks, health checks, auth callbacks).

### Request flow diagram

How a single "send-then-display" cycle moves through the stack. Both apps + a job + a Playwright test all enter at different points and converge on the repository:

```
                         ┌─────────────────────────────────┐
                         │  apps/web  (RSC page / client)  │
                         │  apps/admin (RSC page / client) │
                         │  packages/jobs (Trigger.dev)    │
                         │  apps/e2e (Playwright)          │
                         └─────────┬────────────┬──────────┘
                                   │            │
            ┌──────────────────────┘            └────────────────────┐
            │ tRPC                                                    │ HTTP
            │ (in-process caller from RSC                             │ (E2E hook,
            │  or HTTP from client hooks)                             │  health probe)
            ▼                                                          ▼
   ┌──────────────────────┐                              ┌───────────────────────────┐
   │ apps/<app>/src/lib/  │                              │ apps/<app>/app/api/…/     │
   │ trpc/{server,client} │                              │ route.ts                  │
   └──────────┬───────────┘                              └────────────┬──────────────┘
              │                                                       │
              └──────────────────────────┐  ┌───────────────────────-─┘
                                         ▼  ▼
                                  ┌──────────────────────┐
                                  │ packages/api         │
                                  │   router.ts          │  zod input + auth gate
                                  │       ↓              │
                                  │   service.ts         │  business rules, TRPCError
                                  │       ↓              │
                                  │   repository.ts      │  Drizzle, filters.apply()
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  Drizzle    │
                                      │  + Neon PG  │
                                      └──────┬──────┘
                                             │
                                             ▼
                          ┌──────────────────────────────────┐
                          │  packages/<channel>/transports/  │
                          │  twilio · log · folder · outbox  │  ← outbound side
                          │  (only for write paths; reads    │
                          │   stay in the repository)        │
                          └──────────────────────────────────┘
```

Three properties this enforces:

1. **The repository is the only Drizzle call site.** Tests can stub it; the rest of the system never touches the ORM directly.
2. **HTTP route handlers don't duplicate the layering.** They become 10-line adapters: parse query → call `trpc()` → map errors to status codes. See `apps/web/app/api/{whatsapp,sms}-outbox/route.ts` for the canonical shape.
3. **Outbound channels stay one layer deeper.** `@loyalty/{sms,whatsapp}` are write-only strategy packages; their persistence (the outbox tables) is read back through the same repository pattern as anything else. Symmetric, not bolted on.

### End-to-end example: adding push notifications

A full walkthrough of "add a new outbound channel called `push`" using the exact same shape as `sms` / `whatsapp`. Every step is mechanical — if it doesn't fit, the abstraction is leaking and we should fix the abstraction before this feature lands.

**1. Strategy package — `packages/push/`**

```
packages/push/
├── package.json                 (mirror packages/sms/package.json; rename to @loyalty/push)
├── tsconfig.json                (mirror)
├── vitest.config.ts             (mirror)
└── src/
    ├── index.ts                 public API barrel
    ├── types.ts                 PushMessageData, PushResponse, PushTransport,
    │                            ProviderConfig union, PushLogger, PushOutboxDb
    ├── schemas.ts               zod for token shape + payload limits
    ├── errors.ts                PushError + Invalid* + RateLimit + ProviderError
    ├── push-message.ts          fluent builder: .to(token).title(...).body(...).data({...})
    ├── base-push.ts             abstract BasePush class (subclass per use-case)
    ├── manager.ts               PushManager with cached senders + fake()/restore()
    ├── sender.ts                PushSender wraps one transport + structured logging
    ├── fake-sender.ts           FakeSender with assertSent / assertNoneSent / etc.
    ├── factories.ts             fakeMessage() / fakeResponse() for tests
    ├── transports/
    │   ├── fcm.ts               production: Firebase Cloud Messaging (HTTP v1)
    │   ├── log.ts               local: log line per send
    │   ├── folder.ts            local: JSON + HTML preview per send
    │   └── outbox.ts            preview: INSERT into push_outbox
    └── __tests__/
        ├── push-message.test.ts
        ├── manager.test.ts
        ├── fake-sender.test.ts
        └── transports/{fcm,log,folder,outbox}.test.ts
```

**2. Drizzle table — `packages/db/src/schema/push-outbox.ts`**

```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const pushOutbox = pgTable(
  "push_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    to: text("to").notNull(),           // device token (FCM/APNs)
    platform: text("platform").notNull().default("fcm"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data"),                // freeform payload sent alongside
    status: text("status").notNull().default("sent"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    toSentAtIdx: index("push_outbox_to_sent_at_idx").on(t.to, t.sentAt),
    sentAtIdx: index("push_outbox_sent_at_idx").on(t.sentAt),
  }),
);

export type PushOutboxRow = typeof pushOutbox.$inferSelect;
export type PushOutboxInsert = typeof pushOutbox.$inferInsert;
```

Add to `packages/db/src/schema/index.ts`:

```ts
export * from "./push-outbox";
```

Then:

```bash
bun run db:generate   # → migrations/0002_<name>.sql
```

**3. tRPC feature — `packages/api/src/features/push-outbox/`**

Six files, all mirrors of `sms-outbox/`:

- `schemas.ts` — `listInputSchema`, `getInputSchema`, `latestForRecipientInputSchema` (zod, default `pageSize: 25`).
- `filters.ts` — `PushOutboxFilters` extending `Filters<ListInput, TBuilder>` with `to` (ILIKE), `status` (eq), `search` (ILIKE on body), and maybe `platform` (eq).
- `repository.ts` — `PushOutboxRepository(db)` with `list({ rows, total })`, `findById`, `latestForRecipient`. Uses `$dynamic()` + `filters.apply()` for both rows and count query.
- `service.ts` — `PushOutboxService(repo)` — thin pass-through; throws `TRPCError({ code: "NOT_FOUND" })` on `get(id)` miss.
- `router.ts` — three procedures: `list`, `get`, `latestForRecipient`. Instantiate repo + service per call (don't keep stateful classes between requests).
- `index.ts` — `export { pushOutboxRouter } from "./router"` + the `ListInput` / status types.

Wire into `packages/api/src/routers/_app.ts`:

```ts
import { pushOutboxRouter } from "../features/push-outbox";
// …
export const appRouter = router({
  // …existing
  pushOutbox: pushOutboxRouter,
});
```

**4. App bootstrap — `apps/{web,admin}/src/lib/push.ts`**

```ts
import { db } from "@loyalty/db";
import { PushManager, type ProviderConfig } from "@loyalty/push";

import { env } from "../env";
import { log } from "./log";

function pickDefaultProvider(): "log" | "outbox" | "fcm" | "folder" {
  if (env.PUSH_PROVIDER) return env.PUSH_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "fcm";
  if (process.env.VERCEL_ENV === "preview") return "outbox";
  return "log";
}

const fcmConfig: ProviderConfig | undefined =
  env.FCM_PROJECT_ID && env.FCM_SERVICE_ACCOUNT_KEY
    ? {
        provider: "fcm",
        projectId: env.FCM_PROJECT_ID,
        serviceAccountKey: env.FCM_SERVICE_ACCOUNT_KEY,
      }
    : undefined;

export const push = new PushManager({
  default: pickDefaultProvider(),
  mailers: {
    log: { provider: "log", logger: log },
    outbox: { provider: "outbox", db },
    fcm: fcmConfig,
    folder: env.PUSH_PREVIEW_DIR
      ? { provider: "folder", outputDir: env.PUSH_PREVIEW_DIR }
      : undefined,
  },
  logger: log,
});
```

Add the env vars to `apps/{web,admin}/src/env.ts` (`PUSH_PROVIDER`, `PUSH_PREVIEW_DIR`, `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_KEY`). Use `requireWhen` so FCM keys are only required when `PUSH_PROVIDER=fcm`.

**5. Web dev view — `apps/web/src/features/push-outbox/`**

```
src/features/push-outbox/
├── components/
│   ├── filters-form.tsx           client, nuqs URL state
│   ├── outbox-table.tsx           RSC, calls api.pushOutbox.list
│   ├── outbox-table-skeleton.tsx
│   ├── pagination-controls.tsx    client
│   ├── outbox-list.tsx            list page body (Suspense + filters + table)
│   └── outbox-detail.tsx          detail page body (full payload viewer)
└── lib/
    └── parse-search-params.ts     RawSearchParams → typed list params
```

Screen files (thin wrappers) at `apps/web/app/[locale]/(dev)/push-outbox/page.tsx` + `[id]/page.tsx`. Add `/push-outbox` + `/push-outbox/[id]` to `apps/web/src/i18n/routing.ts` `pathnames`. Add a `PushOutbox` i18n namespace to `apps/web/messages/{es,en}.json`. Add the link to `apps/web/src/features/dev/components/dev-tools-nav.tsx`.

**6. Admin panel — `apps/admin/`**

Mirror of the SMS admin: `apps/admin/src/features/push-outbox/components/{outbox-list,outbox-detail}.tsx` + thin screens under `apps/admin/app/[locale]/(dashboard)/push-outbox/`. Add to admin's `pathnames`.

**7. E2E hook — `apps/web/app/api/push-outbox/`**

Two route handlers, both delegating to tRPC (never touching Drizzle):

```ts
// apps/web/app/api/push-outbox/route.ts
import { NextResponse } from "next/server";

import { isDevOnlyEnabled } from "@/lib/dev-only";
import { trpc } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isDevOnlyEnabled()) return new NextResponse("not found", { status: 404 });
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? undefined;
  const pageSize = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
    100,
  );
  const api = await trpc();
  const { rows } = await api.pushOutbox.list({ to, pageSize, page: 1 });
  return NextResponse.json({ rows });
}
```

**8. Tooling**

- `commitlint.config.ts` → add `"push"` to the scope enum.
- `.gitignore` → un-ignore `.claude/skills/push/` if you author a skill (recommended once it's used in anger).
- `knip.json` → add `src/lib/push.ts` as a side-effect entry in both apps; add `ignoreDependencies: ["firebase-admin"]` (or whichever SDK) to `packages/push`.

**9. Validation**

Before opening the PR:

```bash
bun install
bun run lint
bun run typecheck
bun run test              # the new package adds ~20-30 UTs
bun run knip              # only pre-existing complaints should remain
bun --cwd apps/web run build
bun --cwd apps/admin run build
```

**Total surface for a new channel:** ~30-35 files (most are mirror-of-SMS files you can clone with `cp -R packages/sms packages/push` and search-replace). If your channel needs more, audit whether you're modelling it as the wrong abstraction — twin packages stay sharp because they don't share more than necessary.

---

## 2. Routing: layouts vs screens

- **Layouts (`app/**/layout.tsx`)**: navigation shells + global providers + locale setup. No feature UI, no `trpc()` calls. The `[locale]/layout.tsx` is the canonical place to call `setRequestLocale(locale)`, mount `<Providers>`, and render chrome (locale switcher, install prompt).
- **Screens (`app/**/page.tsx`)**: thin route adapters. They:
  1. `await params` / `await searchParams`.
  2. Call `setRequestLocale(locale)` (next-intl requirement).
  3. Run route-level gates (`notFound()` for dev-only pages).
  4. Render one Feature component and pass parsed params down.

**Good:**

```tsx
// app/[locale]/whatsapp-outbox/page.tsx
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { OutboxList } from "@/features/whatsapp-outbox/components/outbox-list";
import { isDevOnlyEnabled } from "@/lib/dev-only";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isDevOnlyEnabled()) notFound();
  return <OutboxList searchParams={await searchParams} />;
}
```

**Bad:** writing tRPC calls, table rendering, or filter parsing directly inside the route file.

`generateMetadata` and `generateStaticParams` may live in the route file — they are routing concerns.

---

## 3. Data fetching & mutations (tRPC + TanStack Query)

- Server components fetch via the async caller in `src/lib/trpc/server.ts`:
  ```ts
  const api = await trpc();
  const { rows, total } = await api.whatsappOutbox.list({ page, pageSize });
  ```
- Client components use `useTRPC()` from `src/lib/trpc/client.tsx` (TanStack Query under the hood):
  ```ts
  const trpc = useTRPC();
  const { data } = useQuery(trpc.health.ping.queryOptions());
  ```
- Never call `fetch` for our own API. Always go through tRPC.
- Never call `useEffect(() => { fetch(...) })` — this is what TanStack Query exists for.
- Mutations (`useMutation`) must invalidate the relevant query keys on `onSuccess`.
- Route handlers under `app/api/` exist for HTTP-shaped endpoints only (E2E hooks, health checks, auth callbacks). Domain APIs live in `@loyalty/api`.

---

## 4. State (Zustand + URL state)

- **URL is state.** Filters, pagination, tab selection — anything a user might bookmark, share, or refresh — lives in the URL via [`nuqs`](https://nuqs.47ng.com). The `<NuqsAdapter>` is mounted inside `Providers`; use `useQueryState` / `useQueryStates` and let the URL drive Server Component re-renders.
- **Client-only state** (UI toggles, transient form state, ephemeral wizard steps): use Zustand with slice-based stores per feature. Avoid a single mega-store.
- Persisted client state: `zustand/middleware`'s `persist` over `localStorage`. (We don't need MMKV — this is the web, not RN.)
- Server-derived state always belongs in TanStack Query, never in a Zustand store.

---

## 5. Forms & validation (Zod + React Hook Form)

- ALL schemas use `zod`.
- Form schemas live in `src/features/<feature>/schema/`.
- Use `react-hook-form` with `@hookform/resolvers/zod` to keep re-renders surgical.
- Env variables are validated at app boot via `@t3-oss/env-nextjs` in `apps/<app>/src/env.ts`. Never `process.env.X` in components — import from `@/env`.

---

## 6. Styling & UI (shadcn via `@loyalty/ui` + Tailwind v4)

- Style with Tailwind utility classes via `className`. Do not write CSS modules / vanilla CSS unless you need a `@keyframes` or a non-utility CSS feature.
- shadcn primitives ship from `@loyalty/ui` — `Button`, `Card`, `Table`, `Pagination`, `Toaster`, etc. Use them.
- shadcn is **copy-paste**: to evolve `Button`, edit `packages/ui/src/components/ui/button.tsx` directly. Don't wrap it in a thin abstraction layer inside an app.
- Icons: `lucide-react` (already a transitive dep of shadcn). Don't pull in alternative icon sets.
- The `cn()` helper from `@loyalty/ui` is the canonical class merger.
- Toasts: `sonner` (`<Toaster />` mounted in `Providers`, `toast(...)` from anywhere). Base UI does not ship a Toast primitive.

---

## 7. Performance & anti-patterns

- **No deep barrel files.** Bundlers + DX both suffer. Import direct paths:
  - _Bad:_ `import { OutboxTable, FiltersForm } from "@/features/whatsapp-outbox";`
  - _Good:_ `import { OutboxTable } from "@/features/whatsapp-outbox/components/outbox-table";`
  - A feature may expose a `lib/` or `schema/` file directly; the feature folder itself does not need a root barrel.
- `React.memo` / `useMemo` / `useCallback`: only when profiling or stable-callback semantics demand it. Premature memoization makes diffs noisy and tooling slower.
- For long lists, virtualize (`@tanstack/react-virtual`) rather than rendering 1000s of rows.
- Default to **Server Components**. Add `"use client"` only when the file needs `useState` / `useEffect` / browser APIs / event handlers.

---

## 8. HTTP & dates

- HTTP: tRPC handles everything internal. For external APIs, use `fetch` with explicit `cache: "no-store"` semantics and pass results through zod.
- Dates: import from `@loyalty/date` (date-fns under the hood). `<RelativeTime date={...} />` for "5 min ago" rendering. Never `new Date().toLocaleString()` in components.

---

## 9. i18n (next-intl)

- All user-facing text goes through `t()` from `next-intl`.
- Strings live in `apps/<app>/messages/{es,en}.json`.
- Keys are static literals — never `t(\`x.${var}\`)` — so the messages file stays grep-able.
- Inside `app/[locale]/**`: import `Link`, `usePathname`, `useRouter`, `redirect` from `@/i18n/navigation` (NOT `next/link` / `next/navigation`). `notFound` from `next/navigation` is the only exception (locale-agnostic).
- Every screen calls `setRequestLocale(locale)` before any `getTranslations`.

Full details: `.claude/skills/next-intl/SKILL.md`.

---

## 10. Logging & observability

- `import { log } from "@/lib/log"` from anywhere in a server component / route handler / job.
- Don't `console.log` in production paths. Use `log.info({ requestId, ... }, "event")`.
- Better Stack receives logs from `service: "web"` / `"admin"` / `"jobs"`. Source token is per-app.

Full details: `.claude/skills/log/SKILL.md` + `.claude/skills/better-stack/SKILL.md`.

---

## 11. Feature checklist (every new feature)

Before considering a feature done:

- **Architecture**: screen is < 30 lines and contains no fetches or filter parsing.
- **i18n**: all visible strings via `t()` in `messages/{es,en}.json`. Keys are static literals.
- **Dark mode**: every background / text / border color has a `dark:` counterpart.
- **Loading**: every async surface has a `<Suspense fallback={<Skeleton/>}>` boundary or a `isLoading` branch.
- **Error**: every async surface either lets an `error.tsx` boundary catch it or handles `isError` explicitly.
- **Types**: no `any`. Inputs validated by zod. tRPC inferred types reused (`RouterOutputs<"whatsappOutbox", "list">`) instead of redefining shapes.
- **Tests**: where the feature has non-trivial logic (filters, parsers, computeVisible) — UTs in a `__tests__/` folder alongside.
- **Storybook**: shared UI from `@loyalty/ui` has stories in `apps/storybook`. Feature components don't need stories; their integration tests are the page itself.

---

## 12. Where this differs from WeMetVia/mobile

WeMetVia/mobile is Expo + React Native. This repo is Next.js + the web. Concretely:

| Concept | Mobile (Expo Router) | Web (Next App Router) |
| --- | --- | --- |
| Routes | `app/(tabs)/...` with `_layout.tsx` | `app/[locale]/...` with `layout.tsx` |
| Styling | NativeWind | Tailwind v4 |
| Base UI | React Native Reusables | shadcn via `@loyalty/ui` |
| HTTP | `ky` instance | tRPC |
| Date | `dayjs` | `date-fns` (via `@loyalty/date`) |
| Persistence | `react-native-mmkv` | `localStorage` (when needed) |
| Forms | `react-hook-form` + zod | same |
| i18n | `react-i18next` | `next-intl` |
| Splash | Lottie double-splash | n/a (web is instant) |

Everything else — feature folders, dumb screens, no deep barrels, slice-based state, zod-everywhere — is identical.

---

## 13. Reference implementation

`src/features/whatsapp-outbox/` is the canonical feature in this repo. It demonstrates:

- A list page with URL-driven filters (nuqs) + Suspense.
- A detail page using the tRPC server caller for RSC fetching.
- Feature-internal `lib/` helpers (search-param parsing).
- A skeleton component that mirrors the table layout so layout doesn't shift.
- Screens reduced to ~15 lines each.

When in doubt, clone the shape.
