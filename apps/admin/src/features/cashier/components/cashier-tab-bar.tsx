"use client";

import { CupSoda, Gift, Receipt, ScanLine, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

type Href =
  | "/register"
  | "/register/menu"
  | "/register/rewards"
  | "/register/purchases"
  | "/register/profile";

const TABS: { key: string; href: Href; icon: LucideIcon }[] = [
  { key: "tabScan", href: "/register", icon: ScanLine },
  { key: "tabMenu", href: "/register/menu", icon: CupSoda },
  { key: "tabRewards", href: "/register/rewards", icon: Gift },
  { key: "tabPurchases", href: "/register/purchases", icon: Receipt },
  { key: "tabProfile", href: "/register/profile", icon: User },
];

function isActive(pathname: string, href: Href) {
  return href === "/register"
    ? pathname === "/register"
    : pathname.startsWith(href);
}

/**
 * Cashier tab navigation — the main sections of the register, mirroring the
 * customer app's bottom nav. Each tab is its own route (URL-driven), so
 * back/forward and deep-links work. Centered to a comfortable width.
 */
export function CashierTabBar() {
  const t = useTranslations("Cashier");
  const pathname = usePathname();

  return (
    <nav className="bg-card border-border flex flex-none items-stretch justify-center gap-1 border-t px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      {TABS.map((tab) => {
        const active = isActive(pathname, tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex w-24 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-6" />
            <span className="text-xs font-bold">{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
