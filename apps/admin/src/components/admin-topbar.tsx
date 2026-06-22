"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarTrigger,
} from "@loyalty/ui";
import {
  Bell,
  Check,
  ChevronsUpDown,
  LogOut,
  QrCode,
  Store,
  UserCog,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "@/i18n/navigation";

// Hardcoded stores until the locations model lands (multi-store is aspirational;
// the pilot runs one). Wired to the org's stores later.
const STORES = ["allStores", "t4Centro", "t4Norte"] as const;

/**
 * Admin top bar — the mobile sidebar trigger, the greeting + store switcher, and
 * the right-side actions: Cashier mode, notifications, and a user menu with the
 * theme + language toggles, Impersonar, and sign out. Sits inside SidebarInset.
 */
export function AdminTopbar({ name }: { name: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [store, setStore] = useState<(typeof STORES)[number]>("allStores");
  const [signingOut, setSigningOut] = useState(false);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <header className="bg-card border-border sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 sm:px-6">
      <SidebarTrigger className="md:hidden" />

      <div className="min-w-0 flex-1">
        <div className="font-display truncate text-lg font-semibold tracking-tight">
          {t("greeting", { name })}
        </div>
        <div className="text-muted-foreground/80 truncate text-xs font-semibold">
          {t("storesMembers", { stores: 3, members: "12.8K" })}
        </div>
      </div>

      {/* Store switcher */}
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

      {/* Cashier mode */}
      <Button
        type="button"
        onClick={() => router.push("/register")}
        className="bg-foreground text-background hover:bg-foreground/90 h-10 gap-2 rounded-xl font-semibold"
      >
        <QrCode className="size-4" />
        <span className="hidden sm:inline">{t("cashierMode")}</span>
      </Button>

      {/* Notifications */}
      <button
        type="button"
        onClick={() => router.push("/notifications")}
        aria-label={t("notifications")}
        className="border-border bg-card text-muted-foreground hover:text-foreground relative grid size-10 flex-none place-items-center rounded-xl border"
      >
        <Bell className="size-4" />
        <span className="bg-primary absolute top-2 right-2 size-2 rounded-full" />
      </button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex-none rounded-full"
              aria-label={t("account")}
            >
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-60 rounded-xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="text-sm font-semibold">{name}</div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-medium">{t("language")}</span>
            <LocaleSwitcher />
          </div>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-medium">{t("theme")}</span>
            <ThemeToggle />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/customers")}>
            <UserCog />
            {t("impersonate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={signingOut}
            onClick={() => void onSignOut()}
          >
            <LogOut />
            {signingOut ? t("signingOut") : t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
