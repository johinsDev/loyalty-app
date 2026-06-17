import { getTranslations } from "next-intl/server";

import { usuals } from "../data";

/**
 * "Your usuals" — a horizontal rail of roomy vertical cards on mobile (names
 * wrap instead of truncating), settling into a 2-up grid on desktop.
 */
export async function Usuals() {
  const t = await getTranslations("Home");
  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("yourUsuals")}
      </p>
      <div className="scrollbar-hide -mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0">
        {usuals.map((u) => {
          const Icon = u.icon;
          return (
            <div
              key={u.name}
              className="bg-card flex w-40 flex-none flex-col gap-2.5 rounded-2xl p-4 shadow-lg shadow-black/5 ring-1 ring-black/5 lg:w-auto dark:ring-white/10"
            >
              <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-xl">
                <Icon className="size-6" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground text-sm leading-tight font-bold">
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
