"use client";

import { cn } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

type NavItem = {
  href:
    | "/dashboard"
    | "/customers"
    | "/rewards"
    | "/whatsapp-outbox"
    | "/sms-outbox"
    | "/email-outbox";
  key:
    | "dashboard"
    | "customers"
    | "rewards"
    | "whatsappOutbox"
    | "smsOutbox"
    | "emailOutbox";
};

const ITEMS: readonly NavItem[] = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/customers", key: "customers" },
  { href: "/rewards", key: "rewards" },
  { href: "/whatsapp-outbox", key: "whatsappOutbox" },
  { href: "/sms-outbox", key: "smsOutbox" },
  { href: "/email-outbox", key: "emailOutbox" },
];

/**
 * Sidebar nav for the admin dashboard route group. Client component
 * so the active link updates without re-rendering the whole layout
 * when navigating.
 *
 * `usePathname()` from `@/i18n/navigation` returns the canonical
 * English route key ("/dashboard", "/sms-outbox") regardless of the
 * locale-translated public URL.
 */
export function DashboardNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4 text-sm">
      {ITEMS.map((item) => {
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
    </nav>
  );
}
