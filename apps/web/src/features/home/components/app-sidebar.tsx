"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  Bell,
  ChevronsUpDown,
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

import { customer, pointsWallet } from "../data";
import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

type Href = "/" | "/rewards" | "/menu" | "/card" | "/profile";
type Item = { key: string; href: Href; icon: LucideIcon };

const ITEMS: Item[] = [
  { key: "navHome", href: "/", icon: HomeIcon },
  { key: "navRewards", href: "/rewards", icon: Gift },
  { key: "navMenu", href: "/menu", icon: CupSoda },
  { key: "navProfile", href: "/profile", icon: User },
];

// Bigger, on-brand rows: tall, rounded, mint active pill, larger icons.
const ITEM_CLASS =
  "rounded-xl text-base data-active:bg-primary/10! data-active:text-primary! data-active:font-semibold [&_svg]:size-5!";

/**
 * Desktop (md+) navigation — a wide, collapsible, T4-branded sidebar that
 * replaces the mobile bottom bar: brand header, the destinations, a prominent
 * scan button, then a profile chip whose dropdown holds profile/notifications
 * and sign-out. Below md the bottom nav drives instead.
 */
export function AppSidebar() {
  const t = useTranslations("Home");
  const tAuth = useTranslations("Auth");
  const tNotif = useTranslations("Notifications");
  const pathname = usePathname();
  const router = useRouter();
  const openQr = useQrDrawer((s) => s.openDrawer);
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const tier = `🌿 ${t("tierBadge", { tier: pointsWallet.tier })}`;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="bg-primary text-primary-foreground font-display flex aspect-square size-10 items-center justify-center rounded-2xl text-base font-bold">
                T4
              </span>
              <span className="font-display text-lg font-semibold">
                T4 Lovers
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1.5">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              return (
                <SidebarMenuItem key={it.key}>
                  <SidebarMenuButton
                    size="lg"
                    isActive={pathname === it.href}
                    tooltip={t(it.key)}
                    className={ITEM_CLASS}
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

      <SidebarFooter className="gap-2 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={t("navScan")}
              onClick={openQr}
              className="bg-primary text-primary-foreground rounded-xl text-base font-semibold hover:bg-primary/90! hover:text-primary-foreground! [&_svg]:size-5!"
            >
              <QrCode />
              <span>{t("navScan")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={customer.name}
                    className="rounded-xl"
                  >
                    <Avatar className="size-9 rounded-lg">
                      <AvatarFallback className="bg-primary text-primary-foreground rounded-lg text-sm font-bold">
                        AR
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold">
                        {customer.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {tier}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                side="right"
                align="end"
                sideOffset={8}
                className="min-w-56 rounded-xl"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-9 rounded-lg">
                        <AvatarFallback className="bg-primary text-primary-foreground rounded-lg text-sm font-bold">
                          AR
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold">
                          {customer.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {tier}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href="/profile" />}>
                    <User />
                    {t("navProfile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/notifications" />}>
                    <Bell />
                    {tNotif("title")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onClick={() => void onSignOut()}
                >
                  <LogOut />
                  {signingOut ? tAuth("signingOut") : tAuth("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
