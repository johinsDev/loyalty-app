"use client";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@loyalty/ui";
import {
  BarChart3,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Plus,
  Receipt,
  Send,
  Settings,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { useRouter } from "@/i18n/navigation";

type Href = Parameters<ReturnType<typeof useRouter>["push"]>[0];

const NAV: { key: string; href: Href; icon: typeof Users }[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "customers", href: "/customers", icon: Users },
  { key: "purchases", href: "/purchases", icon: Receipt },
  { key: "products", href: "/products", icon: Package },
  { key: "rewards", href: "/rewards", icon: Gift },
  { key: "promotions", href: "/promotions", icon: Sparkles },
  { key: "campaigns", href: "/campaigns", icon: Send },
  { key: "banners", href: "/banners", icon: ImageIcon },
  { key: "analytics", href: "/analytics", icon: BarChart3 },
  { key: "stores", href: "/stores", icon: Store },
  { key: "employees", href: "/employees", icon: Megaphone },
  { key: "settings", href: "/settings", icon: Settings },
];

const ACTIONS: { key: string; href: Href }[] = [
  { key: "newProduct", href: "/products/new" },
  { key: "newReward", href: "/rewards/new" },
  { key: "addCustomer", href: "/customers" },
];

/**
 * ⌘K command palette — global search over the admin: jump to any section or run
 * a quick "new …" action. Opened from the sidebar search button or ⌘K/Ctrl+K.
 * Single instance lives in {@link import("./admin-shell").AdminShell}.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Command");
  const tNav = useTranslations("Nav");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (href: Href) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
    >
      <Command>
        <CommandInput placeholder={t("placeholder")} />
        <CommandList>
          <CommandEmpty>{t("empty")}</CommandEmpty>
          <CommandGroup heading={t("navGroup")}>
            {NAV.map((n) => (
              <CommandItem
                key={n.key}
                value={tNav(n.key)}
                onSelect={() => go(n.href)}
              >
                <n.icon />
                {tNav(n.key)}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t("actionsGroup")}>
            {ACTIONS.map((a) => (
              <CommandItem
                key={a.key}
                value={t(a.key)}
                onSelect={() => go(a.href)}
              >
                <Plus />
                {t(a.key)}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
