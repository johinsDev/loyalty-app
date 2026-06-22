"use client";

import type { Role } from "@loyalty/auth/server";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@loyalty/ui";
import {
  BarChart3,
  Bell,
  CupSoda,
  FlaskConical,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Receipt,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

type Href =
  | "/dashboard"
  | "/customers"
  | "/purchases"
  | "/rewards"
  | "/promotions"
  | "/campaigns"
  | "/notifications"
  | "/banners"
  | "/menu"
  | "/employees"
  | "/analytics"
  | "/settings"
  | "/storage";

type Item = {
  href: Href;
  key: string;
  icon: LucideIcon;
  /** Lowest role that may see this entry. */
  min: "staff" | "manager" | "owner";
};

// Main nav — the full CRM. Role-gated: staff sees the day-to-day, manager adds
// growth/config, owner adds dev tooling.
const ITEMS: Item[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, min: "staff" },
  { href: "/customers", key: "customers", icon: Users, min: "staff" },
  { href: "/purchases", key: "purchases", icon: Receipt, min: "staff" },
  { href: "/rewards", key: "rewards", icon: Gift, min: "manager" },
  { href: "/promotions", key: "promotions", icon: Sparkles, min: "manager" },
  { href: "/campaigns", key: "campaigns", icon: Send, min: "manager" },
  { href: "/notifications", key: "notifications", icon: Bell, min: "manager" },
  { href: "/banners", key: "banners", icon: ImageIcon, min: "manager" },
  { href: "/menu", key: "menu", icon: CupSoda, min: "manager" },
  { href: "/employees", key: "employees", icon: Megaphone, min: "manager" },
  { href: "/analytics", key: "analytics", icon: BarChart3, min: "manager" },
  { href: "/settings", key: "settings", icon: Settings, min: "manager" },
];

const RANK: Record<Role, number> = {
  customer: 0,
  staff: 1,
  manager: 2,
  owner: 3,
};

function isActive(pathname: string, href: Href) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin CRM sidebar — the shadcn collapsible sidebar from @loyalty/ui: full
 * (icon + label) on desktop, collapses to icons, and becomes a drawer on mobile
 * (handled by the primitive). Role-gated; owners get a Dev group. Brand header
 * up top. The active item is resolved from the canonical English route key.
 */
export function AdminSidebar({ role }: { role: Role }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const rank = RANK[role];
  const items = ITEMS.filter((it) => rank >= RANK[it.min]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <span className="bg-primary text-primary-foreground font-display flex aspect-square size-9 items-center justify-center rounded-xl text-sm font-bold">
                T4
              </span>
              <span className="font-display text-base font-semibold">
                Loyalty OS
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <SidebarMenuItem key={it.href}>
                  <SidebarMenuButton
                    isActive={isActive(pathname, it.href)}
                    tooltip={t(it.key)}
                    render={<Link href={it.href} />}
                  >
                    <Icon />
                    <span>{t(it.key)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {role === "owner" ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("devGroup")}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive(pathname, "/storage")}
                  tooltip={t("devTools")}
                  render={<Link href="/storage" />}
                >
                  <FlaskConical />
                  <span>{t("devTools")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
