"use client";

import { Skeleton } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";

import { CashierButton } from "@/components/cashier-button";
import { MobileNav } from "@/components/mobile-nav";
import { StoreSwitcher } from "@/components/store-switcher";
import { CommandPaletteProvider } from "@/lib/command-palette-context";

/**
 * Admin shell — a **static** client frame: a fixed sidebar on desktop (lg+) and a
 * drawer on tablet/mobile, plus the top bar. It reads neither the session cookie
 * nor the `[storeId]` param, so it prerenders as the static shell under
 * `cacheComponents`. Each dynamic piece streams into its own hole:
 *
 * - `nav` / `greeting` — RSC holes (role/name/counts, cookie) passed from the
 *   layout; a client component may render server elements received as props.
 * - {@link MobileNav} / {@link StoreSwitcher} / {@link CashierButton} — client
 *   islands that read the `[storeId]` param (`useParams`), each in a `<Suspense>`.
 *
 * ⌘K is wired through {@link CommandPaletteProvider} so the server-rendered nav's
 * search button can open the palette without crossing a function prop over the
 * server boundary. User menu + notifications live in the nav footer.
 */
export function AdminShell({
  nav,
  greeting,
  children,
}: {
  nav: ReactNode; // <Suspense><NavData/></Suspense> from the layout
  greeting: ReactNode; // <Suspense><Greeting/></Suspense> from the layout
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

            <Suspense fallback={<Skeleton className="hidden h-10 w-40 rounded-xl sm:block" />}>
              <StoreSwitcher />
            </Suspense>

            <Suspense fallback={<Skeleton className="h-10 w-28 rounded-xl" />}>
              <CashierButton />
            </Suspense>
          </header>

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
