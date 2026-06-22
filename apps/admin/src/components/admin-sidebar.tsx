"use client";

import type { Role } from "@loyalty/auth/server";
import {
  Kbd,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@loyalty/ui";
import {
  BarChart3,
  Bell,
  FlaskConical,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Package,
  Receipt,
  Search,
  Send,
  Settings,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";

type Href =
  | "/dashboard"
  | "/customers"
  | "/purchases"
  | "/products"
  | "/rewards"
  | "/promotions"
  | "/campaigns"
  | "/notifications"
  | "/banners"
  | "/analytics"
  | "/stores"
  | "/employees"
  | "/settings"
  | "/storage";

type RoleMin = "staff" | "manager" | "owner";
type Item = { href: Href; key: string; icon: LucideIcon; badge?: string };
type Group = { label: string; min: RoleMin; items: Item[] };

// The CRM nav, grouped by section to match the design. Role-gated per group:
// staff sees PRINCIPAL, manager+ adds catalog/marketing/analysis/operation,
// owner adds DEV.
const GROUPS: Group[] = [
  {
    label: "groupMain",
    min: "staff",
    items: [
      { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { href: "/customers", key: "customers", icon: Users, badge: "12.8K" },
      { href: "/purchases", key: "purchases", icon: Receipt },
    ],
  },
  {
    label: "groupCatalog",
    min: "manager",
    items: [
      { href: "/products", key: "products", icon: Package },
      { href: "/rewards", key: "rewards", icon: Gift },
      { href: "/promotions", key: "promotions", icon: Sparkles, badge: "4" },
    ],
  },
  {
    label: "groupMarketing",
    min: "manager",
    items: [
      { href: "/campaigns", key: "campaigns", icon: Send },
      { href: "/notifications", key: "notifications", icon: Bell },
      { href: "/banners", key: "banners", icon: ImageIcon },
    ],
  },
  {
    label: "groupAnalysis",
    min: "manager",
    items: [{ href: "/analytics", key: "analytics", icon: BarChart3 }],
  },
  {
    label: "groupOps",
    min: "manager",
    items: [
      { href: "/stores", key: "stores", icon: Store },
      { href: "/employees", key: "employees", icon: Megaphone },
    ],
  },
];

const RANK: Record<Role, number> = { customer: 0, staff: 1, manager: 2, owner: 3 };
const ROLE_RANK: Record<RoleMin, number> = { staff: 1, manager: 2, owner: 3 };

// Mint active pill + bigger icons, matching the customer sidebar + the design.
const ITEM_CLASS =
  "data-active:bg-primary/10! data-active:text-primary! data-active:font-semibold";

function isActive(pathname: string, href: Href) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Admin CRM sidebar — the @loyalty/ui collapsible sidebar (icons on desktop,
 * drawer on mobile), styled to the t4-admin design: brand + role header, a ⌘K
 * search, section groups (PRINCIPAL / CATÁLOGO / …), a mint active pill, count
 * badges, and a staggered entrance. Role-gated; owners get a DEV group.
 */
export function AdminSidebar({ role }: { role: Role }) {
  const t = useTranslations("Nav");
  const tAuth = useTranslations("Roles");
  const pathname = usePathname();
  const fade = useFadeUp({ step: 35 });
  const rank = RANK[role];
  const groups = GROUPS.filter((g) => rank >= ROLE_RANK[g.min]);
  let i = 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <span className="bg-primary text-primary-foreground font-display flex aspect-square size-9 items-center justify-center rounded-xl text-sm font-bold">
                T4
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-base font-semibold">
                  T4 Admin
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {tAuth(role)}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Global search — opens the command palette (seam); hidden when collapsed. */}
        <div className="relative px-1 group-data-[collapsible=icon]:hidden">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <SidebarInput
            placeholder={t("search")}
            className="h-9 pr-12 pl-9"
            readOnly
          />
          <Kbd className="absolute top-1/2 right-3 -translate-y-1/2">⌘K</Kbd>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((it) => {
                const Icon = it.icon;
                const style = fade(i++);
                return (
                  <SidebarMenuItem key={it.href} style={style}>
                    <SidebarMenuButton
                      isActive={isActive(pathname, it.href)}
                      tooltip={t(it.key)}
                      className={ITEM_CLASS}
                      render={<Link href={it.href} />}
                    >
                      <Icon />
                      <span>{t(it.key)}</span>
                    </SidebarMenuButton>
                    {it.badge ? (
                      <SidebarMenuBadge>{it.badge}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {role === "owner" ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("devGroup")}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive(pathname, "/storage")}
                  tooltip={t("devTools")}
                  className={ITEM_CLASS}
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

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive(pathname, "/settings")}
              tooltip={t("settings")}
              className={ITEM_CLASS}
              render={<Link href="/settings" />}
            >
              <Settings />
              <span>{t("settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
