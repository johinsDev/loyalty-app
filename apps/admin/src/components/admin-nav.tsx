"use client";

import { authClient } from "@loyalty/auth/client";
import type { Role } from "@loyalty/auth/server";
import {
  Avatar,
  AvatarFallback,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@loyalty/ui";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronRight,
  FlaskConical,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  type LucideIcon,
  Megaphone,
  MoreHorizontal,
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
import { useEffect, useState } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationsInbox } from "@/components/notifications-inbox";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

type Href = string;
type Sub = { href: Href; key: string };
type Item = {
  href: Href;
  key: string;
  icon: LucideIcon;
  badge?: string;
  sub?: Sub[];
};
type RoleMin = "staff" | "manager" | "owner";
type Group = { label: string; min: RoleMin; items: Item[] };

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
    items: [
      {
        href: "/analytics",
        key: "analytics",
        icon: BarChart3,
        sub: [
          { href: "/analytics", key: "overview" },
          { href: "/analytics/cohorts", key: "cohorts" },
          { href: "/analytics/funnel", key: "funnel" },
        ],
      },
    ],
  },
  {
    label: "groupOps",
    min: "manager",
    items: [
      { href: "/stores", key: "stores", icon: Store },
      { href: "/employees", key: "employees", icon: Megaphone },
      {
        href: "/settings",
        key: "settings",
        icon: Settings,
        sub: [
          { href: "/settings", key: "brand" },
          { href: "/settings/team", key: "team" },
          { href: "/settings/integrations", key: "integrations" },
        ],
      },
    ],
  },
];

const RANK: Record<Role, number> = { customer: 0, staff: 1, manager: 2, owner: 3 };
const ROLE_RANK: Record<RoleMin, number> = { staff: 1, manager: 2, owner: 3 };

function active(pathname: string, href: Href) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(`${href}/`);
}

const ROW =
  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors";
const ROW_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";
const ROW_ACTIVE = "bg-primary/10 text-primary";

/**
 * The admin sidebar content — brand + role header, ⌘K search, grouped nav with
 * collapsible submenus (Campañas / Analytics / Ajustes), and a footer with the
 * user menu + notifications inbox. Used inside both the fixed desktop aside and
 * the mobile/tablet drawer (Sheet); `onNavigate` closes the drawer on tap.
 */
export function AdminNav({
  role,
  name,
  onNavigate,
  onOpenSearch,
}: {
  role: Role;
  name: string;
  onNavigate?: () => void;
  onOpenSearch?: () => void;
}) {
  const t = useTranslations("Nav");
  const tRoles = useTranslations("Roles");
  const pathname = usePathname();
  const groups = GROUPS.filter((g) => RANK[role] >= ROLE_RANK[g.min]);

  return (
    <div className="bg-card flex h-full flex-col">
      {/* Brand + role */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <span className="bg-primary text-primary-foreground font-display grid size-9 flex-none place-items-center rounded-xl text-sm font-bold">
          T4
        </span>
        <div className="leading-tight">
          <div className="font-display text-base font-semibold">T4 Admin</div>
          <div className="text-muted-foreground text-xs font-medium">
            {tRoles(role)}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="border-border bg-muted/50 text-muted-foreground hover:text-foreground relative flex h-10 w-full items-center rounded-lg border pr-12 pl-9 text-sm"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <span>{t("search")}</span>
          <Kbd className="absolute top-1/2 right-3 -translate-y-1/2">⌘K</Kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="scrollbar-hide flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="text-muted-foreground/70 px-3 pb-1 text-xs font-extrabold tracking-wider">
              {t(group.label)}
            </div>
            <div className="space-y-0.5">
              {group.items.map((it) =>
                it.sub ? (
                  <SubmenuItem
                    key={it.href}
                    item={it}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <Link
                    key={it.href}
                    href={it.href as never}
                    onClick={onNavigate}
                    className={`${ROW} ${active(pathname, it.href) ? ROW_ACTIVE : ROW_IDLE}`}
                  >
                    <it.icon className="size-5 flex-none" />
                    <span className="flex-1">{t(it.key)}</span>
                    {it.badge ? (
                      <span className="text-muted-foreground/80 text-xs font-semibold">
                        {it.badge}
                      </span>
                    ) : null}
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}

        {role === "owner" ? (
          <div>
            <div className="text-muted-foreground/70 px-3 pb-1 text-xs font-extrabold tracking-wider">
              {t("devGroup")}
            </div>
            <Link
              href={"/storage" as never}
              onClick={onNavigate}
              className={`${ROW} ${active(pathname, "/storage") ? ROW_ACTIVE : ROW_IDLE}`}
            >
              <FlaskConical className="size-5 flex-none" />
              <span>{t("devTools")}</span>
            </Link>
          </div>
        ) : null}
      </nav>

      {/* Footer user menu + inbox */}
      <div className="border-border flex items-center gap-1 border-t p-2">
        <UserMenu name={name} />
        <NotificationsInbox />
      </div>
    </div>
  );
}

function SubmenuItem({
  item,
  pathname,
  onNavigate,
}: {
  item: Item;
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const isActive = item.sub!.some((s) => active(pathname, s.href));
  // Controlled: a derived `defaultOpen` would change as the route changes while
  // the sidebar stays mounted, which Base UI warns about. Open on mount/whenever
  // the active route lands inside this submenu; let the user collapse manually.
  const [open, setOpen] = useState(isActive);
  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={`${ROW} group/sm w-full ${isActive ? "text-foreground" : ROW_IDLE}`}
      >
        <item.icon className="size-5 flex-none" />
        <span className="flex-1 text-left">{t(item.key)}</span>
        <ChevronRight className="size-4 transition-transform group-data-[panel-open]/sm:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-0.5 space-y-0.5 pl-7">
        {item.sub!.map((s) => (
          <Link
            key={s.href + s.key}
            href={s.href as never}
            onClick={onNavigate}
            className={`flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
              pathname === s.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t(s.key)}
          </Link>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function UserMenu({ name }: { name: string }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "T4";

  const onSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Popover>
      <PopoverTrigger
        className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {name}
        </span>
        <MoreHorizontal className="text-muted-foreground size-4 flex-none" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64 rounded-xl p-0">
        <div className="border-border border-b p-3">
          <div className="text-sm font-semibold">{name}</div>
        </div>
        <div className="p-1.5">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="hover:bg-muted flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium"
          >
            <Settings className="size-4" />
            {t("settingsLink")}
          </button>
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-sm font-medium">{t("theme")}</span>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
            <span className="text-sm font-medium">{t("language")}</span>
            <LocaleSwitcher />
          </div>
          <MenuLink icon={LifeBuoy} label={t("help")} />
          <MenuLink icon={BookOpen} label={t("docs")} />
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10"
          >
            <LogOut className="size-4" />
            {t("signOut")}
          </button>
        </div>
        <div className="border-border flex items-center gap-2 border-t p-3 text-xs">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">{t("platformStatus")}</span>
          <span className="ml-auto font-semibold text-emerald-600">
            {t("allNormal")}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MenuLink({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      className="hover:bg-muted flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
