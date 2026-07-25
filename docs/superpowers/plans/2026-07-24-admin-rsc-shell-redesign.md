# Admin RSC Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin chrome render as a static frame with each piece (role-gated nav, greeting, counts, store switcher, page) streaming into its own hole, so reloading a store-scoped page paints the frame instantly instead of a "skeleton-of-everything", and returning to a filtered list re-uses the Worker cache instead of re-querying Turso.

**Architecture:** `cacheComponents: true` is already on (committed). The outer shell (`app/layout` + `[locale]/layout`) already prerenders statically. This plan fixes the `[storeId]` shell: today `StoreShell` `await`s role + scope + counts in ONE Suspense hole, so the whole chrome blocks on the slowest of three Worker hops. We split it into a **static frame** (structural chrome, no cookie/param reads) plus **independent holes**: role→nav (RSC, cookie), name+counts→greeting (RSC, cookie, Worker-cached), store scope→switcher (client island, `useParams` + hydrated `switcherList`). Route protection moves per-page (co-located `requireRole`), out of the blocking shell path. Point 12 (list query recycling) is solved by Worker-caching `adminList` keyed on org+filters — protected reads can't use `use cache` (it forbids the cookie), so Worker-cache is the tool; public reads like branding already use `use cache`.

**Tech Stack:** Next 16 (App Router, `cacheComponents`/PPR), React 19 (`Suspense`, `cache()`), tRPC v11 (HTTP caller → Cloudflare Worker), `@loyalty/cache` (`cachedRead` → Upstash), react-query (client islands only), nuqs (URL state), next-intl. Bun 1.2.10 (pinned — do NOT use 1.3.x).

**The validator is the build.** There are no unit tests for RSC layouts in this repo; correctness is proven by `cd apps/admin && bun run build` (which, with `cacheComponents` on, enumerates every dynamic read outside a Suspense) plus `bun run lint && bun run typecheck && bun run test` at the root. Each task's "test" steps run these. The build runs headless in this env (DATABASE_URL / NEXT_PUBLIC_API_URL / BETTER_AUTH_SECRET are present).

**Baseline:** branch `perf/admin-cachecomponents`, HEAD `a05aac7` (green: 70 PPR routes, lint/typecheck/test pass). No push until Johan asks.

---

## Reference — the cache-layer decision (read before Task 1)

Full write-up in `.claude/skills/nextjs-data-fetching-patterns/SKILL.md` (§ "Next 16 cacheComponents"). The one rule that drives every choice here:

- **`use cache` forbids dynamic APIs** (`cookies()`/`headers()`/`searchParams`/`params`). Our RSC tRPC caller (`apps/admin/src/lib/trpc/server.ts`) reads `headers()` to forward the session cookie → **any protected procedure cannot be wrapped in `use cache`**. Only cookie-free (public) reads can — that's why `getBranding` (public `settings.branding`) could and admin list/count reads cannot.
- **Protected admin reads → Worker-cache** (`cachedRead(ctx, key, ttl, factory)` in `packages/api/src/trpc.ts`). Key MUST include the org (and any scope/filter/period). `navCounts` + the 15 dashboard aggregates are already Worker-cached; `adminList` is not (Task 1).
- **Anything reading the cookie or the `[storeId]` param is dynamic** → it must live inside a `<Suspense>` or it breaks the static prerender. The static frame is the chrome that reads *neither*.

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `packages/api/src/routers/customers.ts` (+ purchases, rewards, promotions, banners, campaigns, employees routers) | Worker-cache `adminList` keyed on org+filters | 1 |
| `packages/api/src/features/_shared/list-cache.ts` (new) | `listCacheKey(name, org, input)` — stable hash of list input for the cache key | 1 |
| `apps/admin/src/lib/store-scope.tsx` | `useStoreScope()` client hook fed by `useParams` + hydrated `switcherList` (drops the server-injected provider value) | 2 |
| `apps/admin/src/lib/store-scope-server.ts` | `getStoreScope(segment)` server helper (rename/keep `loadStoreScope`) — the server half of the dual | 2 |
| `apps/admin/src/components/store-switcher.tsx` | Client island: `useStoreScope()` + hydrated list | 2 |
| `apps/admin/app/[locale]/(dashboard)/[storeId]/layout.tsx` | Static frame + `<Suspense>` holes (nav, greeting) + client scope provider | 3 |
| `apps/admin/src/components/admin-shell.tsx` | Client frame: owns drawer state, renders structural chrome, slots `nav`/`greeting` holes | 3 |
| `apps/admin/src/features/shell/nav-data.tsx` (new) | RSC hole: resolves role → renders client `AdminNav` | 3 |
| `apps/admin/src/features/shell/greeting.tsx` (new) | RSC hole: resolves name + counts → renders greeting | 3 |
| `apps/admin/src/components/admin-nav.tsx` | Client nav, `role` prop (unchanged shape), scoped links read `useParams` | 3 |
| `apps/admin/src/components/admin-shell-skeleton.tsx` | Exact frame-shaped fallback (already exists; refine dimensions) | 3, 5 |
| `apps/admin/src/lib/auth-guard.ts` | Add `requireStaff()` / keep `requireRole()` for per-page co-location | 4 |
| Each `app/[locale]/(dashboard)/[storeId]/**/page.tsx` async section | Co-located `await requireRole(...)` | 4 |
| `apps/admin/app/[locale]/(dashboard)/layout.tsx` | Deleted (gate moves per-page) | 4 |

---

## Task 1: Worker-cache the admin list reads (point 12)

**Why first:** independent of the shell, immediately fixes "re-filtering re-queries Turso", shippable alone.

**Files:**
- Create: `packages/api/src/features/_shared/list-cache.ts`
- Modify: `packages/api/src/routers/customers.ts:199-201`
- Test: `cd apps/admin && bun run build` + root `bun run typecheck`

- [ ] **Step 1: Write the cache-key helper**

Create `packages/api/src/features/_shared/list-cache.ts`:

```ts
/**
 * Stable cache key for a paginated/filtered admin list read. The Worker cache is
 * the only cache available for these reads — they're protected procedures, so the
 * cookie-forwarding RSC caller can't wrap them in Next's `use cache` (which
 * forbids dynamic APIs). The key MUST include the org and the full list input
 * (filters + sort + page), so a repeated filter hits the cache and a changed
 * filter is a distinct entry. See the `cache` + `nextjs-data-fetching-patterns`
 * skills.
 */
export function listCacheKey(name: string, orgId: string, input: unknown): string {
  // Deterministic stringify: sort keys so `{a,b}` and `{b,a}` hash equal.
  const stable = JSON.stringify(input, Object.keys(input as object).sort());
  return `list:${name}:${orgId}:${stable}`;
}
```

- [ ] **Step 2: Wrap the customers `adminList` read**

Modify `packages/api/src/routers/customers.ts:199-201`. The current code:

```ts
  adminList: managerProcedure
    .input(customersListInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).adminList(await requireOrg(), input)),
```

becomes:

```ts
  adminList: managerProcedure
    .input(customersListInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await requireOrg();
      return cachedRead(ctx, listCacheKey("customers", org, input), 60, () =>
        readSvc(ctx.db).adminList(org, input),
      );
    }),
```

Add the imports at the top of the file (match existing import style):

```ts
import { cachedRead } from "../trpc";
import { listCacheKey } from "../features/_shared/list-cache";
```

(Check the existing relative-path depth for `../trpc` in this file and match it; `customers.ts` is in `src/routers/`, so `../trpc` and `../features/_shared/list-cache` are correct.)

- [ ] **Step 3: Verify the build + typecheck pass**

Run: `cd apps/admin && bun run build`
Expected: exit 0, still "70 PPR routes" (this is a Worker-side change, transparent to the FE).

Run: `cd /Users/johan/Documents/personal-projects/loyalty-app && bun run typecheck`
Expected: `27 successful, 27 total`.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/features/_shared/list-cache.ts packages/api/src/routers/customers.ts
git commit -m "perf(api): read-through cache the customers adminList by org+filters"
```

- [ ] **Step 5: Repeat Steps 2-4 for the other six lists**

Apply the identical wrap to each list's `adminList` (or equivalent list query) — `purchases`, `rewards`, `promotions`, `banners`, `campaigns`, `employees` — using its own `name` in `listCacheKey` (`"purchases"`, …) and including its store scope in the org arg where the query is store-scoped (purchases/rewards/promotions/banners pass a `storeId`; fold it into the key: `listCacheKey("purchases", org, { ...input, storeId })`). One commit per router. After each: `bun run typecheck` green.

> **Invalidation:** these use a 60s TTL (tolerate ≤60s staleness), matching the existing dashboard/nav-counts caching. Explicit `revalidateTag`-style invalidation on mutation is Task 6 (optional). Do NOT add per-mutation invalidation here — ship the TTL version first.

---

## Task 2: Store scope as a server/client dual + hydrated switcher island

**Why:** the shell (Task 3) needs the active store scope, but resolving it must not block the frame. Server components get `getStoreScope(segment)` (Worker-cached `switcherList` + pure resolve); client components get `useStoreScope()` fed by `useParams` + a hydrated `switcherList` query. The switcher is the one genuine client island.

**Files:**
- Modify: `apps/admin/src/lib/store-scope-server.ts` (keep `loadStoreScope`, export as `getStoreScope` alias)
- Modify: `apps/admin/src/lib/store-scope.tsx` (client hook reads `useParams` + hydrated query; drop the server-injected `value` prop)
- Modify: `apps/admin/src/components/store-switcher.tsx` (already client; now reads the new hook)
- Modify: `apps/admin/src/i18n/nav.tsx` (`Link`/`useRouter`/`usePathname` read segment from `useParams`, not the context)
- Test: build + typecheck

- [ ] **Step 1: Server half — alias `getStoreScope`**

Modify `apps/admin/src/lib/store-scope-server.ts`. Keep `loadStoreScope` (Worker-cached, request-deduped via `cache()`) and add a named alias so server callers read `getStoreScope`:

```ts
export const getStoreScope = loadStoreScope;
```

(Leave existing `loadStoreScope` call-sites in the page `TableSection`s untouched.)

- [ ] **Step 2: Client half — `useStoreScope` from `useParams` + hydrated list**

Rewrite `apps/admin/src/lib/store-scope.tsx` so it no longer needs a server-injected `value`. The segment comes from the URL (`useParams`), the store list from a hydrated `switcherList` query:

```tsx
"use client";

import type { StoreSwitcherItem } from "@loyalty/api/features/stores/schemas";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { useTRPC } from "@/lib/trpc/client";

export const ALL_STORES = "all";

export interface StoreScopeValue {
  segment: string;
  storeId: string | null;
  store: StoreSwitcherItem | null;
  stores: StoreSwitcherItem[];
}

function resolveScope(stores: StoreSwitcherItem[], segment: string) {
  if (segment === ALL_STORES) return { storeId: null as string | null, store: null as StoreSwitcherItem | null };
  const store = stores.find((s) => s.slug === segment || s.id === segment) ?? null;
  return { storeId: store?.id ?? null, store };
}

/**
 * Active store scope, resolved **client-side** from the `[storeId]` URL segment
 * + a hydrated `switcherList` query, so no server round-trip blocks the shell.
 * The list is prefetched on the server (Worker-cached) and hydrated, so the
 * switcher label is correct on first paint. Consumers must live inside a dynamic
 * boundary (they read `useParams`), which every shell hole / page already is.
 */
export function useStoreScope(): StoreScopeValue {
  const params = useParams();
  const segment = typeof params.storeId === "string" ? params.storeId : ALL_STORES;
  const trpc = useTRPC();
  const { data } = useQuery({ ...trpc.stores.switcherList.queryOptions(), staleTime: 60_000 });
  const stores = data ?? [];
  return useMemo<StoreScopeValue>(
    () => ({ segment, ...resolveScope(stores, segment), stores }),
    [segment, stores],
  );
}
```

> Note: this removes `StoreScopeProvider` and `StoreScopeContext`. Grep for their imports (`grep -rn "StoreScopeProvider\|StoreScopeContext" apps/admin/src apps/admin/app`) and remove them — the layout no longer wraps a provider (Task 3), and `i18n/nav.tsx` switches to `useParams` (next step). If any non-shell consumer relied on the context, point it at `useStoreScope()`.

- [ ] **Step 3: `i18n/nav.tsx` reads the segment from `useParams`**

In `apps/admin/src/i18n/nav.tsx`, replace `useSegment()` (which read `StoreScopeContext`) with a `useParams`-based read:

```tsx
import { useParams } from "next/navigation";

function useSegment(): string {
  const params = useParams();
  return typeof params.storeId === "string" ? params.storeId : "all";
}
```

Remove the `StoreScopeContext` import. `Link`/`useRouter` keep their existing `scopeHref(href, segment)` logic — only the segment source changes.

- [ ] **Step 4: Switcher reads the new hook**

`apps/admin/src/components/store-switcher.tsx` already calls `useStoreScope()` (destructures `segment, store, stores`) — no change needed beyond confirming it compiles against the new hook shape (it does; same field names).

- [ ] **Step 5: Prefetch + hydrate `switcherList` so the label is correct on first paint**

In `apps/admin/app/[locale]/(dashboard)/[storeId]/layout.tsx` (fully rewritten in Task 3), the switcher's query is hydrated via the app's existing tRPC prefetch pattern. If no `HydrationBoundary` is wired for it, the switcher shows its skeleton for one tick then fills — acceptable. Defer the hydration wiring to Task 3 where the layout is rewritten; here just ensure `useStoreScope` works standalone (it does — `useQuery` fetches client-side if not hydrated).

- [ ] **Step 6: Build + typecheck + commit**

Run: `cd apps/admin && bun run build` → exit 0. `bun run typecheck` → green.

```bash
git add apps/admin/src/lib/store-scope.tsx apps/admin/src/lib/store-scope-server.ts apps/admin/src/i18n/nav.tsx
git commit -m "refactor(admin): store scope as server getStoreScope + client useStoreScope (URL-driven)"
```

---

## Task 3: Decompose the store shell — static frame + independent holes

**Why:** the core fix. Today `StoreShell` awaits role + scope + counts together in one hole → the whole chrome blocks. Split so the frame is static and each dynamic piece streams alone.

**The boundary rule (drives every decision):** a component is part of the **static frame** only if it reads *neither* the cookie *nor* the `[storeId]` param. Role/name/counts read the cookie → RSC holes. Scoped nav links + switcher + cashier button read the param → they live inside holes / client islands. Expect to **iterate the build**: it names each dynamic read that escapes a boundary.

**Files:**
- Create: `apps/admin/src/features/shell/nav-data.tsx`
- Create: `apps/admin/src/features/shell/greeting.tsx`
- Modify: `apps/admin/src/components/admin-shell.tsx`
- Modify: `apps/admin/app/[locale]/(dashboard)/[storeId]/layout.tsx`
- Modify: `apps/admin/src/components/admin-nav.tsx` (drop the `navCounts` prop; keep its self-owned `useQuery` for counts)
- Test: build (must stay 70 PPR routes / no "Uncached data outside Suspense") + lint + typecheck

- [ ] **Step 1: `NavData` RSC hole — resolves role, renders the client nav**

Create `apps/admin/src/features/shell/nav-data.tsx`:

```tsx
import { AdminNav } from "@/components/admin-nav";
import { getMe } from "@/lib/auth-guard"; // export getMe from auth-guard (see Task 4 Step 1)

/**
 * RSC hole for the sidebar. Resolves the member role (cookie → dynamic, so this
 * only renders inside the layout's `<Suspense>`), then hands it to the client
 * `AdminNav`, which owns the interactive bits (active-state, collapsibles, ⌘K,
 * scoped links via `useParams`). Deduped per request via `getMe`'s `cache()`.
 */
export async function NavData({ onOpenSearch }: { onOpenSearch?: () => void }) {
  const me = await getMe();
  return <AdminNav role={me?.role ?? "staff"} name={me?.user.name?.trim() || "Equipo"} />;
}
```

> `onOpenSearch` can't cross the server→client boundary as a function prop. The search trigger + drawer live in the client `AdminShell`; `AdminNav` receives no callbacks from the server hole. Keep `AdminNav`'s `onOpenSearch`/`onNavigate` optional and wire them only where `AdminShell` renders `AdminNav` directly on the client (drawer). For the desktop rail rendered via the hole, the ⌘K button calls a client handler exposed through context or is simply always-mounted in `AdminShell`. **Simplest:** keep the whole `AdminNav` (rail + drawer) rendered by `AdminShell` (client) and pass only `role`/`name` down from the hole as **serializable props** — see Step 3's structure. Adjust this component to return the resolved `{role, name}` values consumed by `AdminShell`, OR render `AdminNav` here without the callback props. Let the build + the AdminShell structure in Step 3 settle which; the resolved values are what matter.

- [ ] **Step 2: `Greeting` RSC hole — name + Worker-cached counts**

Create `apps/admin/src/features/shell/greeting.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

import { getMe } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

/**
 * RSC hole for the top-bar greeting + org totals. Name comes from the session
 * (cookie → dynamic, in Suspense); the counts are the manager-only
 * `dashboard.navCounts` (protected → Worker-cached 60s, NOT `use cache`).
 */
export async function Greeting() {
  const me = await getMe();
  const t = await getTranslations("Admin");
  const name = me?.user.name?.trim() || "Equipo";
  let counts: Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["dashboard"]["navCounts"]>> | null = null;
  if (me && me.role !== "staff" && me.role !== "customer") {
    counts = await (await trpc()).dashboard.navCounts().catch(() => null);
  }
  return (
    <div className="min-w-0 flex-1">
      <div className="font-display truncate text-lg font-semibold tracking-tight">
        {t("greeting", { name })}
      </div>
      {counts ? (
        <div className="text-muted-foreground/80 truncate text-xs font-semibold">
          {t("storesMembers", { stores: counts.stores, members: counts.customers })}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `AdminShell` — static frame that slots the holes**

`AdminShell` stays a client component (it owns the drawer `useState`), but it no longer takes `role`/`name`/`navCounts` props. Instead it takes rendered **slot elements** (`nav`, `greeting`) — RSC holes rendered by the layout and passed through (a client component may render server elements received as props). The frame structure (rails, header bar, brand, search, cashier button) renders synchronously. Only the slots suspend.

```tsx
"use client";

import { Button, Sheet, SheetContent, SheetTitle } from "@loyalty/ui";
import { Menu, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { CommandPalette } from "@/components/command-palette";
import { StoreSwitcher } from "@/components/store-switcher";
import { useRouter } from "@/i18n/nav";
import { useStoreScope } from "@/lib/store-scope";

export function AdminShell({
  nav,
  greeting,
  children,
}: {
  nav: ReactNode;      // <Suspense><NavData/></Suspense> from the layout
  greeting: ReactNode; // <Suspense><Greeting/></Suspense> from the layout
  children: ReactNode;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const { storeId } = useStoreScope();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const openCashier = () =>
    router.push(storeId ? { pathname: "/register", query: { storeId } } : "/register");

  return (
    <div className="bg-card flex h-screen overflow-hidden">
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <aside className="border-border hidden w-64 flex-none border-r lg:block">{nav}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          {nav}
        </SheetContent>
      </Sheet>
      <div className="bg-muted/30 flex min-w-0 flex-1 flex-col">
        <header className="bg-card border-border flex flex-none items-center gap-3 border-b px-4 py-3 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("menu")}
            className="border-border bg-card text-muted-foreground hover:text-foreground grid size-10 flex-none place-items-center rounded-xl border lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          {greeting}
          <StoreSwitcher />
          <Button
            type="button"
            onClick={openCashier}
            className="bg-foreground text-background hover:bg-foreground/90 h-10 gap-2 rounded-xl font-semibold"
          >
            <QrCode className="size-4" />
            <span className="hidden sm:inline">{t("cashierMode")}</span>
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

> **⌘K + search button:** the search trigger currently lives in `AdminNav`. Since `AdminNav` is now rendered inside the `nav` hole (server-passed) it can't call `AdminShell`'s `setSearchOpen`. Move the search button into the static frame (top bar) OR expose `searchOpen` via a tiny client context (`CommandPaletteProvider`) that both the frame and the nav consume. Recommend: a `useCommandPalette()` client context mounted in the frame; `AdminNav`'s search button calls `open()` from it. Wire this when the build/interaction is verified.
>
> **`useStoreScope()` in `AdminShell`:** reads `useParams` → dynamic. If the build flags `AdminShell` (frame) as forcing dynamic because of this, move the cashier button's `storeId` read into its own tiny client child in a `<Suspense>`, or read `storeId` lazily inside `openCashier` (via a ref-free re-read). Let the build decide; the frame must stay static.

- [ ] **Step 4: Rewrite the layout — static passthrough with holes**

`apps/admin/app/[locale]/(dashboard)/[storeId]/layout.tsx`:

```tsx
import { type ReactNode, Suspense } from "react";

import { AdminShell } from "@/components/admin-shell";
import { ListPageSkeleton } from "@/components/data-table";
import { ImpersonationBanner } from "@/features/employees/components/impersonation-banner";
import { GreetingSkeleton, NavSkeleton } from "@/components/admin-shell-skeleton";
import { Greeting } from "@/features/shell/greeting";
import { NavData } from "@/features/shell/nav-data";

/**
 * Store shell. A static frame (`AdminShell`) with each dynamic piece streaming
 * into its own hole: the role-gated nav, the name+counts greeting, and the page.
 * Nothing here `await`s at the top, so the frame prerenders and the pieces fill
 * in independently — no "skeleton of everything" on reload. Route protection is
 * per-page (Task 4) + the Worker (every procedure is role-gated).
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      nav={<Suspense fallback={<NavSkeleton />}><NavData /></Suspense>}
      greeting={<Suspense fallback={<GreetingSkeleton />}><Greeting /></Suspense>}
    >
      <ImpersonationBanner />
      <Suspense fallback={<ListPageSkeleton />}>{children}</Suspense>
    </AdminShell>
  );
}
```

- [ ] **Step 5: Trim `AdminNav`**

Drop the `navCounts` prop from `AdminNav` (it already self-owns `useQuery(dashboard.navCounts)`; remove the `initialData` branch and the `navCounts` param + `NavCounts` type import). Keep `role`/`name`. Confirm scoped `<Link>`s still work (they read the segment via `useParams` after Task 2).

- [ ] **Step 6: Iterate the build until green**

Run: `cd apps/admin && bun run build`. For each "Uncached data accessed outside `<Suspense>`" the build names, apply the boundary rule (move the offending param/cookie read into a hole or a client island). Re-run until exit 0 with **70 PPR routes** (no regression). This is the research step — budget several iterations.

- [ ] **Step 7: lint + typecheck + commit**

Run root `bun run lint && bun run typecheck && bun run test` → all green.

```bash
git add apps/admin/src/features/shell apps/admin/src/components/admin-shell.tsx apps/admin/src/components/admin-nav.tsx apps/admin/app/[locale]/\(dashboard\)/\[storeId\]/layout.tsx apps/admin/src/components/admin-shell-skeleton.tsx
git commit -m "perf(admin): decompose store shell into static frame + streamed holes"
```

---

## Task 4: Per-page route protection (co-located `requireRole`)

**Why:** the redirect for a signed-out / wrong-role user should not sit in the blocking shell path. Co-locate it in each page's async data section (already inside a Suspense), where it dedupes with the page's own reads via `getMe`'s `cache()`. Data security is the Worker's (every procedure is role-gated); this is only the UX redirect.

**Files:**
- Modify: `apps/admin/src/lib/auth-guard.ts` (export `getMe`; add `requireStaff`/`requireManager` sugar)
- Modify: each `app/[locale]/(dashboard)/[storeId]/**/page.tsx` async section
- Delete: `apps/admin/app/[locale]/(dashboard)/layout.tsx`
- Test: build + typecheck; manual role-bounce check in dev

- [ ] **Step 1: Export `getMe` + add role sugar in `auth-guard.ts`**

In `apps/admin/src/lib/auth-guard.ts`, change `const getMe = cache(...)` to `export const getMe = cache(...)` (NavData/Greeting import it). Add:

```ts
import { MANAGER_OR_ABOVE, STAFF_OR_ABOVE } from "@loyalty/auth/server";

export const requireStaff = () => requireRole(STAFF_OR_ABOVE);
export const requireManager = () => requireRole(MANAGER_OR_ABOVE);
```

- [ ] **Step 2: Add the guard to each page's async section**

Every store-scoped page already has an `async` data section (the list pages' `TableSection`, the dashboard/detail pages' top-level `async`). Add the role gate as its first line. Staff+ pages (customers, purchases, dashboard) → `await requireStaff()`. Manager+ pages (products, rewards, promotions, loyalty, campaigns, banners, analytics, stores, settings) → `await requireManager()`. Employees stays manager+ (it already had a layout gate — fold it into the page and delete `employees/layout.tsx` too if it only gated).

Example — `customers` `TableSection`:

```ts
async function CustomersTableSection({ params, searchParams }: Props) {
  await requireStaff();                 // ← redirect gate, deduped via getMe cache()
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return <CustomersTable searchParams={sp} />;
}
```

- [ ] **Step 3: Delete the group gate layout**

```bash
git rm "apps/admin/app/[locale]/(dashboard)/layout.tsx"
```

(Its `requireRole(STAFF_OR_ABOVE)` is now covered per-page + by the Worker.)

- [ ] **Step 4: Build + typecheck + manual bounce check**

Run: `cd apps/admin && bun run build` → exit 0, 70 PPR routes.
Run: `bun run typecheck` → green.
Manual (dev, port 3003): sign in as staff → `/all/employees` should bounce to `/sign-in?error=forbidden`; as customer → any admin route bounces to `/sign-in`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): co-locate role gates per page, drop the group gate layout"
```

---

## Task 5: Exact skeletons (no layout shift)

**Why:** the frame + hole fallbacks must match the final rendered dimensions exactly, so filling a hole causes zero CLS.

**Files:**
- Modify: `apps/admin/src/components/admin-shell-skeleton.tsx` (add named `NavSkeleton`, `GreetingSkeleton` used by Task 3)
- Test: build + visual check in dev

- [ ] **Step 1: Export the exact-dimension sub-skeletons**

In `apps/admin/src/components/admin-shell-skeleton.tsx`, export `NavSkeleton` (matches `AdminNav`: brand row h-9, search h-10, 2 group headers + rows h-10, footer) and `GreetingSkeleton` (two lines: h-5 w-48 title + h-3 w-32 subtitle — exactly the greeting's dims). Use string keys in `.map` (oxlint forbids array-index keys). Measure against the real components (control heights are h-10 in admin) so the skeleton occupies identical space.

- [ ] **Step 2: Build + visual check + commit**

Run: `cd apps/admin && bun run build` → exit 0. Dev: reload `/all/dashboard`, confirm the sidebar rail + top bar hold their size while the nav/greeting fill in (no jump).

```bash
git add apps/admin/src/components/admin-shell-skeleton.tsx
git commit -m "polish(admin): exact-dimension shell skeletons to kill layout shift"
```

---

## Task 6 (optional): Instant invalidation on mutations

**Why:** Tasks 1 + navCounts use a 60s TTL. If a badge count or a list must reflect a mutation instantly (not ≤60s later), invalidate on write. Skip unless the staleness is visibly wrong in use — the TTL is usually fine.

**Files:**
- Modify: mutation call-sites that already call `router.refresh()` after list-changing writes (row actions, wizards, dialogs)
- Modify: `packages/api/src/trpc.ts` (add a `bustList(ctx, name, org)` helper if adopting server-side busting)

- [ ] **Step 1: Client-side (already partly present)** — confirm list-changing mutations call `router.refresh()` (from `@/i18n/nav`) + `invalidateQueries` after success (the server-table rollout added these). The `router.refresh()` re-runs the RSC, which re-reads the Worker cache — so for instant reflection the Worker entry must also be busted (next step) or the TTL accepted.

- [ ] **Step 2: Server-side busting (only if needed)** — add a `del(key)`-style bust to the mutation's Worker path for the affected `listCacheKey`/`dash:navCounts` prefix, or shorten that list's TTL. Do NOT build a tag system unless profiling demands it. `log()` any cache that stays on TTL so the staleness is visible, not silent.

- [ ] **Step 3: Build + typecheck + commit** per change.

---

## Self-review notes

- **Spec coverage:** points 1-2 (per-page auth+role) → Task 4; 3 (static rest) → Task 3; 4+11 (counts RSC-hole; already Worker-cached, not `use cache` — protected) → Task 3 (`Greeting` hole) + reference note; 5-6 (role/name server, context is transport) → Task 3 (`NavData`/`Greeting` holes, role prop into client nav); 7 (switcher = client island) → Task 2; 8 (dashboard stats cache by period) → already Worker-cached (commit 9cce6ce), reference note; 9 (exact skeletons) → Task 5; 10 (`getStoreScope`/`useStoreScope` dual) → Task 2; 12 (list recycling) → Task 1.
- **Honest limits:** `use cache` + `cacheTag` is available only for the public branding read (done); every protected admin read (counts, dashboard, lists) uses Worker-cache — a fast repeat (~5ms Turso-skip) but still a Vercel→Worker hop, NOT a 0ms client-cache hit. True 0ms recycling would need react-query (rejected: keeps tables server-rendered) or a Worker internal-token BFF (rejected: security surface). This is the deliberate trade.
- **Build is the gate:** Task 3 Step 6 is the iteration point; the exact static/hole boundary for `useParams`-reading client bits is discovered from build output, not predicted.
```
