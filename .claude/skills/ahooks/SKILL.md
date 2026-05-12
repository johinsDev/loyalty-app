---
name: ahooks
description: When and how to use the ahooks library in React/Next.js apps in this monorepo. Use when reaching for a generic React hook (debounce, throttle, controlled value, event listener, lifecycle, etc.) so you grab a battle-tested implementation from ahooks instead of hand-rolling one. Also use when deciding whether to write a custom hook from scratch.
---

# ahooks — React hooks library

> https://ahooks.js.org · https://github.com/alibaba/hooks

`ahooks` is the production-grade React hooks library from Alibaba. It is TypeScript-first, SSR-safe, tree-shakeable, and ships dozens of hooks covering the things every React app re-invents: debounce, throttle, controlled inputs, event listeners, lifecycle helpers, storage, viewport/size observers, list/scroll helpers, and more.

## The rule

**Before writing a custom hook, search ahooks.** Only hand-roll a hook when ahooks does not cover the case.

Why: hand-rolled `useDebounce` / `useThrottle` / `useControllableValue` / `useEventListener` / etc. are easy to write *almost* correctly and very hard to write *fully* correctly (stale closures, SSR hydration mismatches, missing cleanup, ref/state edge cases). Every team that writes their own ends up with subtle bugs. ahooks already paid that cost.

**How to apply, in order:**

1. Need a hook? Open https://ahooks.js.org and scan the sidebar (State / Effect / DOM / Advanced / LifeCycle / Scene). The category names match the problem you're solving.
2. If ahooks has it → install ahooks in the consuming app (see below) and import it.
3. If ahooks does *not* have it → write a custom hook in the consuming package (typically `apps/web/lib/hooks/` or `apps/admin/lib/hooks/`). Keep it co-located with the feature, not in `packages/ui`, unless it is generic enough to share.
4. Never copy an ahooks source file into our repo to avoid the dependency. Just install the dependency.

## Install

ahooks is a peer dep of the *consuming app*, not the shared `packages/ui`. UI primitives in `@loyalty/ui` should not pull ahooks transitively — they take state via props.

```bash
# in the app that needs it
bun add ahooks --filter @loyalty/web
bun add ahooks --filter @loyalty/admin
```

Pin to a `^` range so security patches flow in via `bun update`.

## What we actually reach for

The catalog below is the short list — the ones that come up in a loyalty / point-of-sale UI. The full inventory is on the docs site.

### State — controlled inputs, booleans, toggles, storage

| Hook                       | Use it for                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| `useControllableValue`     | A component that should work both controlled (`value` + `onChange`) and uncontrolled (`defaultValue`). Replaces the manual "is it controlled?" check. |
| `useBoolean` / `useToggle` | Open/close dialogs, expanded/collapsed sections, edit-mode flags.                  |
| `useCounter`               | Quantity steppers (e.g., "how many stamps to redeem"), pagination indexes.        |
| `useLocalStorageState`     | Persist non-sensitive UI prefs (last selected store, theme). **Not** auth tokens. |
| `useSessionStorageState`   | Same, scoped to tab.                                                              |
| `useResetState`            | State that needs a "reset to initial" action without writing the reducer.         |

### Effect — debounce, throttle, async safety

| Hook                              | Use it for                                                              |
| --------------------------------- | ----------------------------------------------------------------------- |
| `useDebounce` / `useDebounceFn`   | Debounce a value (e.g., search input) or a callback (e.g., save draft). |
| `useThrottle` / `useThrottleFn`   | Throttle scroll/resize handlers, telemetry pings.                       |
| `useDebouncedEffect` (`useDebounceEffect`) | Run an effect only after the deps have been stable for N ms.    |
| `useLockFn`                       | Prevent double-submit on async handlers (e.g., "redeem reward" button). |
| `useAsyncEffect`                  | Effects that need async cleanup without the "make async wrapper" dance. |

### Lifecycle

| Hook                          | Use it for                                                              |
| ----------------------------- | ----------------------------------------------------------------------- |
| `useMount` / `useUnmount`     | Run something once on mount/unmount — replaces `useEffect(() => …, [])`. |
| `useUpdateEffect`             | Effect that skips the initial render — only runs on subsequent updates. |
| `usePrevious`                 | Compare current vs previous value (animations, change detection).       |
| `useLatest`                   | Always read the latest value of a prop/state inside a stable callback (closure-trap fix). |
| `useMemoizedFn`               | Stable function identity with always-current closure. Replaces hand-rolled `useCallback` + ref patterns. |

### DOM — listeners, observers, viewport

| Hook                  | Use it for                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `useEventListener`    | Attach a window/document/element listener with auto-cleanup.            |
| `useClickAway`        | "Close on outside click" for dropdowns, popovers (we also use Base UI). |
| `useHover`            | Hover state for cards/buttons.                                          |
| `useInViewport`       | Lazy-load images, fire telemetry when a section scrolls into view.      |
| `useSize`             | Observe element size (ResizeObserver wrapped).                          |
| `useResponsive`       | Breakpoint-aware rendering. Prefer Tailwind classes first; reach for this only when you genuinely need JS-level branching. |
| `useKeyPress`         | Keyboard shortcuts (e.g., `/` to focus search).                         |
| `useDocumentVisibility` | Pause polling/animations when tab is backgrounded.                    |
| `useNetwork`          | Show an "offline" banner. Pairs well with the PWA offline page.         |

### Scene — list & pagination patterns

| Hook                  | Use it for                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `useInfiniteScroll`   | Infinite lists (history of redemptions, customers).                     |
| `useVirtualList`      | Long virtualized lists (admin: customers table).                        |
| `useDynamicList`      | Editable lists where rows can be added/removed/reordered.               |
| `useCountDown`        | "Reward expires in 02:14" timers.                                       |

## Hooks we do **not** use from ahooks

Skip these — we already have a better tool in the stack:

| ahooks hook                                | Why skip                                                              |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `useRequest`                               | We use **TanStack Query** (`@tanstack/react-query`) for all server state. Don't introduce a second cache layer. |
| `usePagination` (the data-fetching one)    | Same — use TanStack Query's paginated patterns.                       |
| `useFusionTable` / `useAntdTable`          | Antd / Fusion specific. We use Base UI + shadcn.                      |

## Usage examples

### Debounced search input

```tsx
import { useState } from "react";
import { useDebounce } from "ahooks";

export function CustomerSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 300 });

  // hand this to TanStack Query — debounced changes drive the queryKey
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

### Lock a redeem button against double-submit

```tsx
import { useLockFn } from "ahooks";

export function RedeemButton({ onRedeem }: { onRedeem: () => Promise<void> }) {
  const handleClick = useLockFn(async () => {
    await onRedeem();
  });
  return <button onClick={handleClick}>Redeem</button>;
}
```

### Controlled-or-uncontrolled input

```tsx
import { useControllableValue } from "ahooks";

type Props = {
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
};

export function StampInput(props: Props) {
  const [value, setValue] = useControllableValue<string>(props, { defaultValue: "" });
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
```

## SSR / Next.js notes

- ahooks is SSR-safe. The hooks that touch `window` / `document` (e.g., `useEventListener`, `useSize`, `useNetwork`) guard internally and no-op on the server.
- Any component that uses a DOM-touching hook is still a **client component** — mark the file with `"use client"`. RSCs cannot use hooks.
- Avoid `useLocalStorageState` for anything auth-related — Better Auth manages session cookies. Use it only for UI prefs.

## Decision flow

```
need a hook?
   │
   ▼
search ahooks docs ──── found ───► install + import ahooks
   │
   not found
   │
   ▼
write custom hook in apps/<app>/lib/hooks/
   ├── name it useXxx
   ├── one concern per hook
   ├── return either a tuple or an object — pick one and stick to it
   └── if generic enough to share → move to packages/ui after a second consumer appears
```

## Red flags in review

- A new file `lib/use-debounce.ts` / `lib/use-throttle.ts` / `lib/use-click-away.ts` in a PR — push back and replace with ahooks.
- A `useEffect` with a `setTimeout` that looks like a debounce — replace with `useDebounceFn`.
- A `useState` + `useEffect` chain trying to detect "controlled vs uncontrolled" — replace with `useControllableValue`.
- A handler attached with `addEventListener` in a `useEffect` — replace with `useEventListener`.
- An async submit handler without guard against double-clicks — wrap with `useLockFn`.
