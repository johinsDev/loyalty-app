import { getTranslations } from "next-intl/server";

import { NotificationsBell } from "@/features/notifications/components/notifications-bell";
import { CustomerStoreSwitcher } from "@/features/store/components/customer-store-switcher";

import { customer } from "../data";

export async function GreetingHeader() {
  const t = await getTranslations("Home");
  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          <span className="font-display text-muted-foreground text-sm">
            {t("greeting")}
          </span>
          <span className="font-display text-foreground text-2xl font-semibold tracking-tight">
            {customer.name} {customer.emoji}
          </span>
        </div>
        <NotificationsBell />
      </div>
      {/* Store switcher — self-hides for single-store orgs. */}
      <CustomerStoreSwitcher />
    </header>
  );
}
