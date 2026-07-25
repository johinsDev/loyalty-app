"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";

import { MobileNav } from "@/components/mobile-nav";
import { CommandPaletteProvider } from "@/lib/command-palette-context";

/**
 * Admin shell — a **static** client frame: a fixed sidebar on desktop (lg+) and a
 * drawer on tablet/mobile, plus the top bar. It reads neither the session cookie
 * nor the `[storeId]` param, so it prerenders as the static shell under
 * `cacheComponents`. Each dynamic piece streams into its own hole:
 *
 * - `nav` / `greeting` / `scopeIslands` — RSC holes passed from the layout (role,
 *   name+counts, and the store-scoped switcher + cashier seeded server-side); a
 *   client component may render server elements received as props.
 * - {@link MobileNav} — client island that reads `usePathname` (to close on
 *   navigation), in its own `<Suspense>`.
 *
 * ⌘K is wired through {@link CommandPaletteProvider} so the server-rendered nav's
 * search button can open the palette without crossing a function prop over the
 * server boundary. User menu + notifications live in the nav footer.
 */
export function AdminShell({
  nav,
  greeting,
  scopeIslands,
  children,
}: {
  nav: ReactNode; // <Suspense><NavData/></Suspense> from the layout
  greeting: ReactNode; // <Suspense><Greeting/></Suspense> from the layout
  scopeIslands: ReactNode; // <Suspense><ScopeIslands/></Suspense> (switcher + cashier)
  children: ReactNode;
}) {
  const t = useTranslations("Admin");

  return (
    <CommandPaletteProvider>
      <div className="bg-card flex h-screen overflow-hidden">
        {/* Desktop sidebar (nav is a self-suspending RSC hole) */}
        <aside className="border-border hidden w-64 flex-none border-r lg:block">{nav}</aside>

        <div className="bg-muted/30 flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="bg-card border-border flex flex-none items-center gap-3 border-b px-4 py-3 lg:px-6">
            <Suspense
              fallback={
                <span className="border-border bg-card grid size-10 flex-none place-items-center rounded-xl border lg:hidden" />
              }
            >
              <MobileNav nav={nav} label={t("menu")} />
            </Suspense>

            {greeting}

            {scopeIslands}
          </header>

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
