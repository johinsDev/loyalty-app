"use client";

import { CupSoda, Gift, Home as HomeIcon, QrCode, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
    <motion.div layout className="relative flex" transition={SPRING}>
      {active ? (
        <motion.span
          layoutId="navPill"
          transition={SPRING}
          className="bg-primary/10 absolute inset-0 rounded-full"
        />
      ) : null}
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className="relative z-10 flex items-center rounded-full px-3.5 py-2.5"
      >
        <Icon
          className={`size-6 transition-colors ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <AnimatePresence initial={false}>
          {active ? (
            <motion.span
              layout
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={SPRING}
              className="text-primary overflow-hidden text-sm font-semibold whitespace-nowrap"
            >
              <span className="pl-2">{label}</span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Link>
    </motion.div>
  );
}

/**
 * Customer app bottom tab bar — mounted once in the locale layout so it stays
 * put across client navigations. That persistence is what lets the active pill
 * (a shared `layoutId` element) *slide* between tabs and expand to reveal the
 * label, the way a native tab bar does, instead of snapping on every route
 * change. An elevated, gently pulsing center button opens the scan QR drawer.
 * Centered to a phone width and `md:hidden` — desktop uses the sidebar.
 */
export function BottomNav() {
  const t = useTranslations("Home");
  const pathname = usePathname();
  const openQr = useQrDrawer((s) => s.openDrawer);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <nav className="bg-card border-border fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-between border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      {LEFT.map((tab) => (
        <Tab
          key={tab.key}
          tab={tab}
          active={isActive(pathname, tab.href)}
          label={t(tab.key)}
        />
      ))}

      <div className="relative -mt-8 size-16 shrink-0">
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

      {RIGHT.map((tab) => (
        <Tab
          key={tab.key}
          tab={tab}
          active={isActive(pathname, tab.href)}
          label={t(tab.key)}
        />
      ))}
    </nav>
  );
}
