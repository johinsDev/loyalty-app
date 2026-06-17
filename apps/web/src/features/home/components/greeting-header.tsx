import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

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
      <Link
        href="/notifications"
        aria-label={t("notificationsAria")}
        className="bg-card relative grid size-11 place-items-center rounded-full shadow-md shadow-black/5"
      >
        <Bell className="text-foreground size-5" />
        <span className="ring-card absolute top-2.5 right-3 size-2.5 rounded-full bg-rose-400 ring-2" />
      </Link>
    </header>
  );
}
