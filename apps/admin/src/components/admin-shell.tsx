"use client";

import type { Role } from "@loyalty/auth/server";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
} from "@loyalty/ui";
import { Check, ChevronsUpDown, Menu, QrCode, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import { useRouter } from "@/i18n/navigation";

const STORES = ["allStores", "t4Centro", "t4Norte"] as const;

/**
 * Admin shell — a fixed sidebar on desktop (lg+) and a drawer on tablet/mobile
 * (below lg, admin-only so the shared mobile breakpoint is untouched). The nav
 * lives in {@link AdminNav}; the top bar holds the menu trigger, greeting, store
 * switcher and Cashier mode. User menu + notifications live in the nav footer.
 */
export function AdminShell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: ReactNode;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState<(typeof STORES)[number]>("allStores");

  return (
    <div className="bg-card flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="border-border hidden w-64 flex-none border-r lg:block">
        <AdminNav role={role} name={name} />
      </aside>

      {/* Tablet/mobile drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <AdminNav role={role} name={name} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="bg-muted/30 flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="bg-card border-border flex flex-none items-center gap-3 border-b px-4 py-3 lg:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("menu")}
            className="border-border bg-card text-muted-foreground hover:text-foreground grid size-10 flex-none place-items-center rounded-xl border lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="font-display truncate text-lg font-semibold tracking-tight">
              {t("greeting", { name })}
            </div>
            <div className="text-muted-foreground/80 truncate text-xs font-semibold">
              {t("storesMembers", { stores: 3, members: "12.8K" })}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="hidden h-10 gap-2 rounded-xl sm:flex"
                >
                  <Store className="size-4" />
                  <span className="max-w-32 truncate">{t(`store.${store}`)}</span>
                  <ChevronsUpDown className="size-4 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48 rounded-xl">
              {STORES.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setStore(s)}>
                  <Store />
                  {t(`store.${s}`)}
                  {store === s ? <Check className="ml-auto size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            onClick={() => router.push("/register")}
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
