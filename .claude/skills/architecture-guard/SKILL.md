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
