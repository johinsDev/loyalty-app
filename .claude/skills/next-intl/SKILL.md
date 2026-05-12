---
name: next-intl
description: How i18n is wired in the loyalty-app monorepo with next-intl. Use when adding a new locale, translating a route, wiring a new server/client component to translations, fixing a "Failed to compile" because someone imported from `next/link`, mirroring the setup into apps/admin, or onboarding a teammate to "where do the strings live and how is the language detected".
---

# next-intl — i18n for the loyalty PWA

Single i18n surface for `apps/web`. Locale-aware routing, server- and client-side translation APIs, automatic language detection, and a typed navigation API that replaces `next/link` and `next/navigation`.

```
apps/web/
├── i18n/
│   ├── routing.ts         ← defineRouting: locales, defaultLocale, localePrefix, pathnames map
│   ├── request.ts         ← getRequestConfig: load messages per locale
│   └── navigation.ts      ← createNavigation: typed Link / useRouter / usePathname / redirect
├── messages/
│   ├── es.json            ← canonical source; keys live here first
│   └── en.json
├── middleware.ts          ← createMiddleware(routing) — locale detection + redirects (becomes proxy.ts in Next 16)
├── app/
│   ├── layout.tsx         ← ROOT: html/body, reads NEXT_LOCALE cookie for <html lang>
│   ├── [locale]/
│   │   ├── layout.tsx     ← setRequestLocale + NextIntlClientProvider + InstallPrompt + LocaleSwitcher
│   │   ├── page.tsx       ← server component, getTranslations("Home")
│   │   ├── profile/       ← English canonical folder; public URL is /perfil (es) or /profile (en)
│   │   └── card/          ← English canonical folder; public URL is /tarjeta (es) or /card (en)
│   ├── offline/           ← locale-agnostic (excluded from middleware matcher)
│   ├── api/               ← excluded from middleware matcher
│   ├── manifest.ts        ← locale-agnostic PWA manifest
│   └── sw.ts              ← service worker, fallback URL is /offline
└── components/
    ├── locale-switcher.tsx← client component, uses Button from @loyalty/ui
    └── install-prompt.tsx ← client component, uses useTranslations("Common")
```

Stack: **`next-intl@4`** + Next 15 App Router.

---

## The rule

**Never import `Link`, `useRouter`, `usePathname`, or `redirect` from `next/link` / `next/navigation` inside any localized route.**
Always import from `@/i18n/navigation`. The typed wrappers know about locale prefixes and the `pathnames` map; the raw Next.js ones don't and will silently route you to the wrong locale's URL.

API routes, the service worker, and the offline page are the only places where the raw Next imports are acceptable, because they're locale-agnostic.

---

## How a request flows

```
Browser   →   middleware.ts             →   app/[locale]/layout.tsx       →   page.tsx
   │              │                              │                              │
   │              ├─ reads Accept-Language       ├─ awaits params               ├─ setRequestLocale(locale)
   │              ├─ reads NEXT_LOCALE cookie    ├─ hasLocale guard → notFound  ├─ getTranslations("Foo")
   │              ├─ picks matching locale       ├─ setRequestLocale(locale)    └─ renders
   │              ├─ rewrites/redirects URL      ├─ <NextIntlClientProvider>
   │              └─ sets NEXT_LOCALE cookie     └─ renders children
```

Language detection priority (next-intl default):

1. Cookie `NEXT_LOCALE` — sticky, set by the middleware on every redirect.
2. `Accept-Language` header — best match against `routing.locales`.
3. Fallback to `routing.defaultLocale` (`es`).

---

## Server vs client vs static — cheat sheet

| Where you are | What to use | Notes |
| --- | --- | --- |
| **Server Component** (default) | `getTranslations("Namespace")`, `getFormatter()`, `getNow()`, `getTimeZone()` from `next-intl/server` | Call `setRequestLocale(locale)` at the top of the page **and** of every layout above it, otherwise static rendering breaks. |
| **Client Component** (`"use client"`) | `useTranslations("Namespace")`, `useLocale()`, `useFormatter()` from `next-intl` | Works automatically — `NextIntlClientProvider` in `[locale]/layout.tsx` supplies the messages. |
| **`generateMetadata`** | `getTranslations({ locale, namespace: "Metadata" })` | Always pass `locale` explicitly. Metadata runs outside the request context, so no `setRequestLocale` magic. |
| **Static rendering (SSG)** | `generateStaticParams()` in `[locale]/layout.tsx` + `setRequestLocale(locale)` in every page **and** layout that calls `getTranslations` | Without `setRequestLocale`, Next falls back to dynamic rendering and SSG is silently lost. |
| **Navigation** | `Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` from `@/i18n/navigation` | Never from `next/link` or `next/navigation`. |
| **Server actions / route handlers** | `getLocale()` from `next-intl/server` | Locale comes from the `NEXT_LOCALE` cookie set by middleware. |
| **Middleware-excluded routes** (`/api/*`, `/offline`, `/sw.js`, static assets) | Plain Next APIs | No translations available — those routes don't go through `NextIntlClientProvider`. |

---

## Routing

```ts
// apps/web/i18n/routing.ts
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",   // /perfil (es) vs /en/profile (en)
  pathnames: {
    "/": "/",
    "/profile": { es: "/perfil",  en: "/profile" },
    "/card":    { es: "/tarjeta", en: "/card" },
  },
});
```

- **`localePrefix: "as-needed"`** keeps default-locale URLs clean (Spanish gets `/perfil`) and prefixes the others (English gets `/en/profile`). Switching to `"always"` would force every URL to carry the prefix.
- **`pathnames`** maps a canonical *internal* route (the folder name under `[locale]/`) to per-locale *public* URLs. **Folders are in English** — they're code, and the repo convention is code-in-English — while the visible URL is translated per locale. So `[locale]/profile/page.tsx` is reachable at `/perfil` (es) and `/en/profile` (en).
- Always write `<Link href="/profile">` (the canonical English route key). The typed navigation API auto-translates it to the user's current locale's URL at render time.
- Adding a new translatable route: create the folder under `[locale]/` with an English name, add an entry to `pathnames` mapping the canonical key to the per-locale URLs, add keys to `messages/{es,en}.json`.

---

## Adding a new locale

1. Append the code to `routing.locales` in `apps/web/i18n/routing.ts`.
2. Create `apps/web/messages/<code>.json` mirroring the existing namespace shape. **Every key in `es.json` must exist** — VSCode's i18n-ally will flag missing keys inline.
3. If any route's slug should differ in that locale, add it to the `pathnames` map.
4. Add a label entry to `LABELS` in `apps/web/components/locale-switcher.tsx`.

That's it. No code changes in pages — `getTranslations` and `useTranslations` pick up the new locale automatically.

---

## Locale switcher

`apps/web/components/locale-switcher.tsx` is a tiny client component built on `Button` from `@loyalty/ui`. With only two locales today it's a toggle — when a third locale lands it should grow into a dropdown (use Base UI `Menu` or the future shadcn `Select` that's planned for `@loyalty/ui`).

Two things it does that aren't obvious:

- Wraps `router.replace` in `useTransition` so the page stays interactive while Next routes — without this, the button gives no feedback during the locale switch.
- Calls `router.replace` (not `push`) so the locale switch doesn't pollute browser history.

---

## VSCode integration

`.vscode/extensions.json` recommends `lokalise.i18n-ally`. Once installed, it:

- Inlines the resolved translation next to every `t("key")` call.
- Flags missing keys in any locale's JSON file.
- Lets you edit translations side-by-side from a dedicated panel (⌘⇧P → "i18n Ally: Open Editor").
- Auto-detects framework via `i18n-ally.enabledFrameworks: ["next-intl"]` in `.vscode/settings.json`.

If a teammate opens the repo and i18n-ally doesn't activate: check that `.vscode/settings.json` is committed (it is) and that `apps/web/messages/{es,en}.json` exist.

---

## Mirroring to apps/admin

Deferred to a follow-up PR. Steps are mechanical:

1. `bun add next-intl` in `apps/admin`.
2. Copy `apps/web/i18n/` to `apps/admin/i18n/`. Decide whether admin needs different locales (probably the same — `es` for the franchise owner, `en` for productized future).
3. Copy `apps/web/middleware.ts` to `apps/admin/middleware.ts`. Adjust the matcher if admin has different excludes.
4. Wrap `apps/admin/next.config.ts` with `createNextIntlPlugin("./i18n/request.ts")`.
5. Move `apps/admin/app/(auth)`, `(dashboard)`, `page.tsx`, `providers.tsx`, `layout.tsx` under `apps/admin/app/[locale]/`.
6. Write the same minimal root `app/layout.tsx` + provider-bearing `[locale]/layout.tsx`.
7. Seed `apps/admin/messages/{es,en}.json`.
8. Build a `LocaleSwitcher` for admin (or factor a shared one — but only after both apps have one).
9. Update `.vscode/settings.json`: `i18n-ally.localesPaths` becomes `["apps/web/messages", "apps/admin/messages"]`.

---

## Testing pattern

For components that use `useTranslations`, wrap them in `NextIntlClientProvider` with mock messages:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";

function renderWithIntl(ui: React.ReactNode, locale = "es") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ Common: { install: "Instalar app" } }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
```

For server components that use `getTranslations`, call `setRequestLocale(locale)` first in the test setup, or render via Next's test utilities. Most server-component logic is better unit-tested at the data layer, not the JSX.

---

## Red flags in review

- **Import from `next/link` or `next/navigation` inside `app/[locale]/**` or `components/**`** — replace with `@/i18n/navigation`.
- **A page calls `getTranslations` but doesn't call `setRequestLocale(locale)` first** — the page silently switches to dynamic rendering. Add the call.
- **A new route appears under `[locale]/` but isn't in the `pathnames` map** — either it doesn't need translated URLs (skip), or it does and was forgotten (add it).
- **Inline Spanish strings in JSX inside `[locale]/`** — move them to `messages/es.json` (and add the English version).
- **`messages/es.json` and `messages/en.json` diverge in shape** — i18n-ally will catch this; CI doesn't yet (TODO: add a structural diff check).
- **A locale switcher built without `useTransition`** — UI freezes during the switch. Wrap `router.replace` in `startTransition`.
- **`<html lang>` hardcoded to `"es"` somewhere** — the root layout reads `NEXT_LOCALE` cookie; don't override it downstream.

---

## Pending: `middleware.ts` → `proxy.ts` (Next 16)

Next.js 16 renames the `middleware.ts` convention to `proxy.ts` (deprecation announced at v16.0.0). We're on `^15.1.0` today, where `middleware.ts` is still the only recognized name — a file called `proxy.ts` would be silently ignored on 15.x.

When we bump Next to 16 (separate PR), the migration is a one-command codemod:

```bash
npx @next/codemod@canary middleware-to-proxy .
```

It renames the file and changes `export function middleware()` → `export function proxy()`. Our current export is `export default createMiddleware(routing)` from next-intl — the default-export pattern is supported under both names, so functionally nothing changes; only the filename and (for non-default exports) the exported function name do. next-intl's `createMiddleware` itself doesn't care which filename you use; Next.js is the one that loads it.

Don't preemptively rename to `proxy.ts` on 15.x — it won't be picked up and locale routing will silently break.

## See also

- `pwa` skill — interaction with the PWA offline fallback URL (`/offline` is locale-agnostic on purpose).
- `tooling` skill — commit scope-enum (`web` for app-level i18n changes; `repo` for skill/CLAUDE.md docs).
- Future `@loyalty/date` package will derive its locale from `useLocale()` / `getLocale()` — never hardcode locale in date formatters.
