"use client";

import type { Role } from "@loyalty/auth/server";
import { Button, Sheet, SheetContent, SheetTitle } from "@loyalty/ui";
import { Menu, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
import { StoreSwitcher } from "@/components/store-switcher";
import { useRouter } from "@/i18n/navigation";

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

          <StoreSwitcher />

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
