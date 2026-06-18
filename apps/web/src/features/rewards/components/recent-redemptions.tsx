import { getTranslations } from "next-intl/server";

import { recentRedemptions } from "../data";

/**
 * "Canjeadas recientemente" — a compact ledger of the latest redemptions so the
 * customer sees their stamp spend at a glance. Sits below the catalog.
 */
export async function RecentRedemptions() {
  const t = await getTranslations("Rewards");

  return (
    <section>
      <h2 className="font-display text-foreground mb-3 text-xl font-semibold tracking-tight">
        {t("recentTitle")}
      </h2>
      <ul className="bg-card divide-border/70 divide-y rounded-3xl px-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {recentRedemptions.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-3.5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-primary/10 grid size-10 shrink-0 place-items-center rounded-xl text-xl">
                {item.emoji}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-foreground truncate text-sm font-bold">
                  {item.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {item.date}
                </span>
              </div>
            </div>
            <span className="text-muted-foreground shrink-0 text-sm font-bold">
              {item.amount}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
