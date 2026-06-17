import { getTranslations } from "next-intl/server";

import { usuals } from "../data";

export async function Usuals() {
  const t = await getTranslations("Home");
  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("yourUsuals")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {usuals.map((u) => {
          const Icon = u.icon;
          return (
            <div
              key={u.name}
              className="bg-card flex items-center gap-3 rounded-[20px] p-3.5 shadow-[0_12px_28px_-20px_rgba(0,3,35,.35)]"
            >
              <span className="text-primary grid size-11 flex-none place-items-center rounded-[15px] bg-gradient-to-br from-[#f1fffb] to-[#d6f6ed]">
                <Icon className="size-6" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm leading-tight font-bold text-foreground">
                  {u.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t("orderedTimes", { count: u.orders })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
