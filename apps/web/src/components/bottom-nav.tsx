"use client";

import { CupSoda, Gift, Home as HomeIcon, QrCode, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { Link, usePathname } from "@/i18n/navigation";

type Href = "/" | "/rewards" | "/menu" | "/profile";
type TabDef = { key: string; href: Href; icon: LucideIcon };

const LEFT: TabDef[] = [
  { key: "navHome", href: "/", icon: HomeIcon },
  { key: "navRewards", href: "/rewards", icon: Gift },
];
const RIGHT: TabDef[] = [
  { key: "navMenu", href: "/menu", icon: CupSoda },
  { key: "navProfile", href: "/profile", icon: User },
];

// Full-bleed onboarding / auth screens own their chrome — no tab bar there.
const HIDDEN_ON = ["/welcome", "/sign-in", "/complete-phone"];

const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

function isActive(pathname: string, href: Href) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Tab({
  tab,
  active,
  label,
}: {
  tab: TabDef;
  active: boolean;
  label: string;
}) {
  const Icon = tab.icon;
  return (
    <div className="flex flex-1 items-center justify-center">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className="relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2"
      >
        {active ? (
          <motion.span
            layoutId="navPill"
            transition={SPRING}
            className="bg-primary/10 absolute inset-0 rounded-2xl"
          />
        ) : null}
        <Icon
          className={`relative z-10 size-6 transition-colors ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <span
          className={`relative z-10 text-xs font-semibold transition-colors ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </Link>
    </div>
  );
}

/**
 * Customer app bottom tab bar — mounted once in the locale layout so it stays
 * put across client navigations. That persistence is what lets the active pill
 * (a shared `layoutId` element) *slide* between tabs the way a native tab bar
 * does, instead of snapping on every route change. The four tabs are equal
 * cells aligned on one baseline; the elevated scan button is positioned
 * absolutely over the center gap so it never shifts the tabs. `md:hidden` —
 * desktop uses the sidebar.
 */
export function BottomNav() {
  const t = useTranslations("Home");
  const pathname = usePathname();
  const openQr = useQrDrawer((s) => s.openDrawer);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <nav className="bg-card border-border fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-stretch border-t px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
      {LEFT.map((tab) => (
        <Tab
          key={tab.key}
          tab={tab}
          active={isActive(pathname, tab.href)}
          label={t(tab.key)}
        />
      ))}

      {/* Reserves the center column the floating scan button sits over. */}
      <div className="w-16 shrink-0" aria-hidden />

      {RIGHT.map((tab) => (
        <Tab
          key={tab.key}
          tab={tab}
          active={isActive(pathname, tab.href)}
          label={t(tab.key)}
        />
      ))}

      <div className="absolute left-1/2 -top-6 size-16 -translate-x-1/2">
        <span
          aria-hidden
          className="bg-primary/40 absolute inset-0 animate-ping rounded-full"
        />
        <button
          type="button"
          onClick={openQr}
          aria-label={t("navScan")}
          className="from-primary to-primary/60 border-card shadow-primary/50 relative grid size-16 place-items-center rounded-full border-4 bg-gradient-to-br text-white shadow-lg transition-transform active:scale-95"
        >
          <QrCode className="size-7" />
        </button>
      </div>
    </nav>
  );
}
