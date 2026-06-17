import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { customer } from "../data";

export async function GreetingHeader() {
  const t = await getTranslations("Home");
  return (
    <header className="flex items-center justify-between">
      <div className="flex flex-col leading-tight">
        <span className="font-display text-[15px] text-muted-foreground">
          {t("greeting")}
        </span>
        <span className="font-display text-[26px] font-semibold tracking-tight text-foreground">
          {customer.name} {customer.emoji}
        </span>
      </div>
      <Link
        href="/notifications"
        aria-label={t("notificationsAria")}
        className="bg-card relative grid size-11 place-items-center rounded-full shadow-[0_6px_16px_-8px_rgba(0,3,35,.25)]"
      >
        <Bell className="size-5 text-foreground" />
        <span className="ring-card absolute top-2.5 right-3 size-2.5 rounded-full bg-[#ff8fa3] ring-2" />
      </Link>
    </header>
  );
}
