"use client";

import { CupSoda, Gift, Home as HomeIcon, QrCode, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

type Href = "/" | "/card" | "/profile";
type Tab = { key: string; href: Href; icon: LucideIcon };

const LEFT: Tab[] = [
  { key: "navHome", href: "/", icon: HomeIcon },
  { key: "navRewards", href: "/card", icon: Gift },
];
const RIGHT: Tab[] = [
  { key: "navMenu", href: "/card", icon: CupSoda },
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
      className={`flex flex-1 flex-col items-center gap-0.5 text-[10px] font-semibold ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-[21px]" />
      <span>{label}</span>
    </Link>
  );
}

/**
 * Customer app bottom tab bar with an elevated center scan button. Centered to a
 * phone width so it reads as a mobile bar even on desktop. Rendered by the home
 * for now; promote to a shared (app) layout once the inner pages adopt it.
 */
export function BottomNav() {
  const t = useTranslations("Home");
  const pathname = usePathname();

  return (
    <nav className="bg-card fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-start px-5 pt-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(0,3,35,.3)]">
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
        <Link
          href="/card"
          aria-label={t("navScan")}
          className="from-primary -mt-6 grid size-[62px] place-items-center rounded-full border-4 border-[var(--card)] bg-gradient-to-br to-[#7fd8c8] text-white shadow-[0_14px_26px_-10px_rgba(27,173,157,.75)]"
        >
          <QrCode className="size-6" />
        </Link>
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
