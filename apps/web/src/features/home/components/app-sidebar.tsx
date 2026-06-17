"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@loyalty/ui";
import {
  CupSoda,
  Gift,
  Home as HomeIcon,
  LogOut,
  QrCode,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

type Href = "/" | "/card" | "/profile";
type Item = { key: string; href: Href; icon: LucideIcon };

const ITEMS: Item[] = [
  { key: "navHome", href: "/", icon: HomeIcon },
  { key: "navRewards", href: "/card", icon: Gift },
  { key: "navScan", href: "/card", icon: QrCode },
  { key: "navMenu", href: "/card", icon: CupSoda },
  { key: "navProfile", href: "/profile", icon: User },
];

/**
 * Desktop (md+) navigation — a collapsible icon sidebar that replaces the mobile
 * bottom bar. Holds the same destinations plus a sign-out action in the footer.
 * Below md the shadcn Sidebar stays out of the way and the bottom nav drives.
 */
export function AppSidebar() {
  const t = useTranslations("Home");
  const tAuth = useTranslations("Auth");
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <CupSoda className="size-5" />
              </span>
              <span className="font-display text-base font-semibold">
                T4 Lovers
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {ITEMS.map((it) => {
              const Icon = it.icon;
              return (
                <SidebarMenuItem key={it.key}>
                  <SidebarMenuButton
                    isActive={pathname === it.href}
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => void onSignOut()}
              disabled={signingOut}
              tooltip={tAuth("signOut")}
            >
              <LogOut />
              <span>{signingOut ? tAuth("signingOut") : tAuth("signOut")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
