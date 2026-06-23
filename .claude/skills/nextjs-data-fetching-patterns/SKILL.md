---
name: nextjs-data-fetching-patterns
description: Decision guide for choosing the right data-fetching / caching / state pattern in a Next.js App Router (RSC) app — server cache vs React Query vs promise+use() vs URL/nuqs vs draft Zustand vs mutations/optimistic, including tRPC. Use when starting a feature or planning a refactor and you need to pick the pattern that fits before writing code.
auto_invoke: false
tools: Read, Grep, Glob, Edit, Write, Bash, WebFetch
version: 1.0.0
---

# Next.js Data-Fetching & State Pattern Decision Guide

Use this when you're about to build a feature or refactor one and need to decide
**how the data should flow**: cached on the server, hydrated into React Query,
streamed via a promise, kept as URL state, kept as client draft state, or mutated
optimistically. Pick the pattern **before** writing code — the wrong choice is
expensive to undo.

> Companion skill: **`next-cache-components`** (vercel-labs/next-skills) is the
> deep dive on the *server* layer only — `use cache`, `cacheLife`, `cacheTag`,
> `revalidateTag`, PPR. It does **not** cover the client layer (React Query, SWR,
> nuqs, Zustand, mutations/optimistic, tRPC). This skill is the **broader
> decision framework** that includes both layers and tells you *which* to reach
> for. Defer to that skill for the mechanics of `use cache`/PPR.

---

## Step 1 — Answer these axes first (they decide everything)

For each piece of data/state, answer in order. The first "yes" usually picks the pattern.

1. **Can the SERVER produce it from the request alone?** (URL params + cookies it
   has, e.g. auth) — if it needs **client-only state** (a Zustand selection, a
   draft the user is editing, a value not in the URL), the server *cannot* →
   it must be a **client** fetch.
2. **Does it change WITHOUT a URL change?** (in-place: toggles, draft edits,
   guest pickers, polling) → needs **client liveness** → React Query / client.
   If it only changes *when the URL changes* (filters committed to URL,
   pagination) → **server / URL-driven**.
3. **Is it a MUTATION?** (write/toggle, wants optimistic UI) → `useMutation` +
   optimistic, or Server Action + `useOptimistic`. A read-only pattern
   (`use()`, `await`) cannot do this.
4. **Is it shared (cacheable across users) or per-user?** Shared + cacheable →
   server Data Cache (`use cache` + `cacheTag`). Per-user → prefetch+hydrate or
   client fetch, **never** shared `use cache`.
5. **Is the consumer an interactive (client) component, or a server component?**
   Server component → just `await` (or `use cache`). Client component that needs
   a server-initiated value → **promise-as-prop + `use()`**, or React Query.
6. **Do many components need it without prop-drilling?** Server components →
   React `cache()` (request-dedup). Client components → React Query **by key**
   (session-dedup). *(`void` vs streaming does NOT solve sharing — the shared
   cache does.)*

**The single most useful question:** *"Does it change without the URL changing?"*
No → server/URL. Yes → React Query/client.

---

## Step 2 — Pattern catalog

### A. Server Component `await` (+ React `cache()`)
**What:** `async function Comp() { const d = await getData() }`. Wrap `getData`
in React `cache()` so multiple server components calling it in one request dedupe
to a single call.
**When:** consumer is a server component; no interactivity needed. The default
for static/presentational content. Kills prop-drilling for server trees (each
component calls `getData()` itself).
**Gotcha:** `await` in the component blocks that subtree until resolved. Put slow
parts behind their own `<Suspense>`.

### B. Next Data Cache — `use cache` / `cacheLife` / `cacheTag` / `revalidateTag`
**What:** server-side, **cross-user shared** cache. Tag data, invalidate by tag.
**When:** data is **shared and cacheable** (a product/sailing detail by id, a
marketing page). The big win against scrapers/cost: one BE call serves everyone;
invalidate by tag on change.
**Gotcha:** never cache **per-user** data here (you'd serve one user's data to
all). Requires `cacheComponents: true` (Next 16+) / `experimental.dynamicIO`
(15.x canary) — verify the flag is on. → see **next-cache-components** skill.

### C. PPR — static shell + dynamic hole
**What:** prerender/cache the whole route shell (B), punch a `<Suspense>` hole for
the one dynamic bit.
**When:** a page that's mostly static-by-id with a small live part (e.g. a product
page cached by id + a live price/stock hole). The canonical "cache everything,
keep one hole fresh" model.
**Key rule:** the dynamic hole must be in its **own** `<Suspense>` so it never
blocks the static shell.

### D. Promise-as-prop + React `use()` + Suspense
**What:** server component creates a promise **without awaiting**, passes it as a
prop to a **client** component, which unwraps with `React.use(promise)` inside a
`<Suspense>`.
```tsx
function Page() {                          // NOT async
  const promise = getData()                // start fetch, don't await
  return <Suspense fallback={<Skel/>}><Table promise={promise}/></Suspense>
}
'use client'
function Table({ promise }) { const data = React.use(promise) }  // suspends
```
**Why it exists:** a client component **can't `await`**, but you want to start the
fetch on the server (early) and stream the shell. `use()` is the bridge.
**When:** consumer is interactive (client) AND the value is server-derivable AND
it refreshes by **navigation** (URL change → new server render → new promise).
**Gotcha:** every URL change makes a new promise → the boundary **re-suspends**
(skeleton flash). For an interactive control you want smooth, prefer React Query
with `keepPreviousData`. `use()` gives a **one-shot resolved value**, not a live
query — no client refetch/mutation.

### E. Prefetch + Hydrate React Query
**What:** server prefetches into a QueryClient, dehydrates, `<HydrationBoundary>`;
client `useQuery`/`useSuspenseQuery` reads the hydrated cache.
```tsx
// server
const qc = new QueryClient()
await qc.prefetchQuery({ queryKey, queryFn })   // await = BLOCKS doc until ready
// or: void qc.prefetchQuery(...)                // void = STREAMS (with useSuspenseQuery + Suspense)
return <HydrationBoundary state={dehydrate(qc)}>{children}</HydrationBoundary>
// client (anywhere, no props): const { data } = useQuery({ queryKey, queryFn })
```
**When:** data is server-derivable AND needs to stay a **live client query**
(refetch/invalidate/mutate after load), AND you want fast first paint.
**`await` vs `void`:** `await` = server holds the whole document until data ready
(slower TTFB, data present at paint, no spinner). `void` + `useSuspenseQuery` +
`<Suspense>` = streams the shell first, data fills in. Blocking vs streaming is a
**choice**, not inherent to React Query.
**Cost:** ships RQ runtime + dehydrated JSON in the HTML.

### F. React Query client fetch (`useQuery`)
**What:** plain client `useQuery`, no server prefetch.
**When:** data is **client-triggered / per-session / depends on client state**
(can't be server-produced), or you don't need SSR data. Use `placeholderData:
keepPreviousData` to avoid skeleton flash when the key changes (e.g. dependent
filters, pagination).
**Kills prop-drilling:** N components calling `useQuery(sameKey)` = 1 cache entry,
1 fetch, no props.

### G. Mutations — React Query `useMutation` (optimistic) vs Server Action + `useOptimistic`
**`useMutation` + `onMutate`:** optimistic update + rollback + **surgical**
`invalidateQueries(['key'])` (refetches only that). Shared cache → all consumers
update together. Best on list/heavy pages and when state is shown in many places.
**Server Action + `useOptimistic` + `revalidateTag`/`router.refresh()`:** RSC-native,
less client JS. But `router.refresh()` is **coarse** (re-fetches the whole route)
and `useOptimistic` is **per-component** (no cross-component sharing). Use raw
`useState` for optimistic → **don't** (manual rollback, desync); `useOptimistic`
exists for this.
**Pick:** heavy list + state shown in multiple spots + already on RQ → `useMutation`.
RSC-first, no RQ, control shown in one place, cheap route refresh → Server Action +
`useOptimistic`.

### H. URL state (nuqs) vs Draft client state (Zustand)
**nuqs / URL state:** the filter/sort/page value lives in the URL. Changing it =
navigation = server re-render. Shareable, back-button works. **When:** per-change
URL sync is acceptable UX (tables, admin, pagination).
**Draft Zustand (`draft` + `applied`):** the user edits a **draft** in memory;
dependent data refetches off the draft (client, React Query); only on **apply()**
do you commit `draft → applied → URL`. **When:** filters are **interdependent** or
need **batching** and you don't want every keystroke to navigate (consumer search
UX). nuqs would spam history and break batching here.
**Rule:** interactive multi-filter "draft then apply" search → Zustand draft +
RQ for dependent data; simple URL-shareable filtering/pagination → nuqs.

---

## Step 3 — Master decision table

| Situation | Pattern |
|---|---|
| Static/presentational, server component | A: `await` + `cache()` |
| Shared & cacheable by id (cross-user) | B: `use cache` + `cacheTag` (+ PPR shell) |
| Mostly static page + one live bit | C: PPR — cached shell + Suspense hole |
| Server-derivable, consumed in a client component, refreshes by navigation | D: promise + `use()` + Suspense |
| Server-derivable, must stay a live client query + fast paint | E: prefetch(`void`) + hydrate + `useSuspenseQuery` |
| Depends on client-only state / per-session / client-triggered | F: client `useQuery` (+ `keepPreviousData`) |
| Write/toggle with optimistic UI, shown in many places | G: `useMutation` + optimistic + `invalidate` |
| Write, RSC-first, single place, no RQ | G: Server Action + `useOptimistic` |
| Filter/sort/page, per-change URL OK (tables/admin) | H: nuqs |
| Interdependent/batched filters (search) | H: Zustand `draft`/`applied`, RQ off the draft |
| Same data in many components, no prop-drilling | server → `cache()`; client → RQ by key |

---

## Step 4 — tRPC maps onto the SAME patterns (it doesn't add a new one)

tRPC = a **typed layer**: client hooks are **React Query under the hood**; a
**server caller** lets you call procedures directly in RSC (no HTTP).

| Pattern above | tRPC form |
|---|---|
| E. prefetch + hydrate | `trpc.x.prefetch(input)` (server) → `HydrationBoundary` → `trpc.x.useQuery(input)` |
| D. promise + `use()` | server caller: `const p = trpc.x(input)` (no await) → `use(p)` in client |
| A. server `await` + `cache()` | the server caller **is** your server function; wrap in `cache()` |
| F. client `useQuery` | `trpc.x.useQuery(input, { placeholderData: keepPreviousData })` |
| G. mutation | `trpc.x.useMutation({ onMutate })` |

**tRPC adds:** end-to-end types, auto query keys (the procedure path *is* the key),
invalidate-by-path, request **batching** (many client calls → 1 HTTP). **Does NOT
change:** the Next Data Cache (still `use cache` separately), `void`/`await`,
URL-vs-client-state decisions. **Cost:** procedures must live in a TS server — if
your BE is a separate service (REST), tRPC means a **BFF layer** in Next that
calls it; weigh the type-safety win against that hop.

---

## Step 5 — Worked cases

- **Product/sailing detail by id (ship, itinerary, photos)** → B/C: `use cache` +
  `cacheTag('item-'+id)` static shell; `revalidateTag` on change. Server components,
  no client JS, no RQ. (Scraper/cost win.)
- **Live price on that page that depends on a client selection (guests/currency)**
  → F: client `useQuery` (server can't produce it; changes without URL). RQ.
- **Live price that only depends on the id (server-derivable, fresh on load)** →
  D: uncached server promise in its **own** Suspense hole. No RQ needed.
- **Search results driven by committed filters in the URL + pagination** → E
  (`void` prefetch + `useSuspenseQuery`, `keepPreviousData`) or D, depending on
  whether you want it live in the client.
- **Search filter sidebar with interdependent draft filters** → H: Zustand
  `draft`/`applied`; dependent histograms/bounds via RQ keyed on the **draft**
  (`useXRangeQuery`); commit to URL on `apply()`. **Not** nuqs, **not** `use()`.
- **Price-range slider bounds that depend on other filters** → if filters are in
  the URL: D (server caller + `cache()` + `use()`) or RQ-suspense; if filters are
  a Zustand draft: F (RQ keyed on draft, `keepPreviousData`).
- **Favorite/heart on a list (logged-in user)** → G: `useMutation` optimistic +
  `invalidate(['favorites'])`; status via RQ `useQuery` **hydrated** (server has
  auth cookie → correct on first paint). Per-user → hydrate yes, shared `use cache`
  no.
- **Admin data table (filter/sort/paginate)** → H: nuqs (URL per change) +
  D/E (server-fetched results). The textbook "tablecn" case.

---

## Anti-patterns

- Using `use()` for data that must refetch in-place (it's one-shot) → use RQ.
- Putting **per-user** data in shared `use cache` → leaks across users.
- `router.refresh()` to update one item on a heavy list → re-fetches the whole
  route; use `invalidateQueries` (surgical) instead.
- Raw `useState` for optimistic → use `useOptimistic` or RQ `onMutate`.
- nuqs per-keystroke on interdependent/batched filters → breaks draft UX; use
  Zustand draft + apply.
- Thinking `void` (vs `await`) solves prop-drilling → it only controls
  streaming-vs-blocking; **the shared cache** (RQ key / `cache()`) solves sharing.
- Making the whole page `'use client'` → keep the shell as server components,
  only the interactive bits as client islands (the real JS-bundle win).

---

## How to apply (workflow)

1. List each data/state piece the feature needs.
2. Run Step 1 axes on each → land on a row of the Step 3 table.
3. If on tRPC, translate via Step 4.
4. For `use cache`/PPR mechanics, consult the **next-cache-components** skill.
5. Keep server vs client islands explicit; default to server, opt into client.
