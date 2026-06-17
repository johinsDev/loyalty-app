import { getTranslations } from "next-intl/server";

import { NotificationsBell } from "@/features/notifications/components/notifications-bell";

import { customer } from "../data";

export async function GreetingHeader() {
  const t = await getTranslations("Home");
  return (
    <header className="flex items-center justify-between">
      <div className="flex flex-col leading-tight">
        <span className="font-display text-muted-foreground text-sm">
          {t("greeting")}
        </span>
        <span className="font-display text-foreground text-2xl font-semibold tracking-tight">
          {customer.name} {customer.emoji}
        </span>
      </div>
      <NotificationsBell />
    </header>
  );
}
