"use client";

import { CupSoda, Gift, Home as HomeIcon, QrCode, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { Link, usePathname } from "@/i18n/navigation";

type Href = "/" | "/rewards" | "/menu" | "/card" | "/profile";
type Tab = { key: string; href: Href; icon: LucideIcon };

const LEFT: Tab[] = [
  { key: "navHome", href: "/", icon: HomeIcon },
  { key: "navRewards", href: "/rewards", icon: Gift },
];
const RIGHT: Tab[] = [
  { key: "navMenu", href: "/menu", icon: CupSoda },
  { key: "navProfile", href: "/profile", icon: User },
];

function TabLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: Href;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-1 flex-col items-center gap-1 pt-1"
    >
      <span
        className={`grid size-10 place-items-center rounded-full transition-colors ${
          active ? "bg-primary/10 text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon className="size-6" />
      </span>
      <span
        className={`text-xs font-semibold ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

/**
 * Customer app bottom tab bar with an elevated, gently pulsing center scan
 * button. Taller than a standard bar and with a pill behind the active tab so
 * the current section reads at a glance. Centered to a phone width so it stays a
 * mobile bar even on desktop. Rendered by the home for now; promote to a shared
 * (app) layout once the inner pages adopt it.
 */
export function BottomNav() {
  const t = useTranslations("Home");
  const pathname = usePathname();
  const openQr = useQrDrawer((s) => s.openDrawer);

  return (
    <nav className="bg-card border-border fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-start border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
      {LEFT.map((tab) => (
        <TabLink
          key={tab.key}
          href={tab.href}
          icon={tab.icon}
          label={t(tab.key)}
          active={pathname === tab.href}
        />
      ))}
      <div className="flex flex-1 justify-center">
        <div className="relative -mt-8 size-16">
          <span
            aria-hidden
            className="bg-primary/40 absolute inset-0 animate-ping rounded-full"
          />
          <button
            type="button"
            onClick={openQr}
            aria-label={t("navScan")}
            className="from-primary to-primary/60 border-card relative grid size-16 place-items-center rounded-full border-4 bg-gradient-to-br text-white shadow-lg shadow-primary/50 transition-transform active:scale-95"
          >
            <QrCode className="size-7" />
          </button>
        </div>
      </div>
      {RIGHT.map((tab) => (
        <TabLink
          key={tab.key}
          href={tab.href}
          icon={tab.icon}
          label={t(tab.key)}
          active={pathname === tab.href}
        />
      ))}
    </nav>
  );
}
