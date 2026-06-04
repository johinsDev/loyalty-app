"use client";

import type { Role } from "@loyalty/auth/server";
import { cn } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

type NavItem = {
  href: "/dashboard" | "/customers" | "/rewards" | "/notifications" | "/promotions";
  key: "dashboard" | "customers" | "rewards" | "notifications" | "promotions";
};

const ITEMS: readonly NavItem[] = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/customers", key: "customers" },
  { href: "/rewards", key: "rewards" },
  { href: "/notifications", key: "notifications" },
  // Promotions wizard — gated to manager+ (the router is `managerProcedure`).
  { href: "/promotions", key: "promotions" },
];

// Dev tooling lives under (dev). Visible only to owners; staff and
// manager see the (dashboard) routes and nothing else.
const DEV_ENTRY = {
  href: "/storage",
  key: "devTools",
} as const;

interface Props {
  /** Role resolved server-side by the (dashboard) layout. */
  role: Role;
}

/**
 * Sidebar nav for the admin dashboard route group. Client component
 * so the active link updates without re-rendering the whole layout
 * when navigating.
 *
 * `usePathname()` from `@/i18n/navigation` returns the canonical
 * English route key ("/dashboard", "/storage") regardless of the
 * locale-translated public URL.
 */
export function DashboardNav({ role }: Props) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const showDevTools = role === "owner";
  const canManage = role === "manager" || role === "owner";
  const items = ITEMS.filter(
    (item) => item.key !== "promotions" || canManage,
  );

  return (
    <nav className="flex flex-col gap-1 p-4 text-sm">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 transition",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(item.key)}
          </Link>
        );
      })}
      {showDevTools ? (
        <Link
          href={DEV_ENTRY.href}
          className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-amber-300 px-3 py-2 text-muted-foreground transition hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950 dark:hover:text-amber-100"
        >
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
            dev
          </span>
          {t(DEV_ENTRY.key)}
        </Link>
      ) : null}
    </nav>
  );
}
