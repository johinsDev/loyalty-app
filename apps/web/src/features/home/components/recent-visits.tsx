import { CupSoda } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { visits } from "../data";

export async function RecentVisits() {
  const t = await getTranslations("Home");
  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("recentVisits")}
      </p>
      <div className="bg-card rounded-3xl px-[18px] py-1.5 shadow-[0_12px_28px_-20px_rgba(0,3,35,.35)]">
        {visits.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between border-b border-[#f0f2f3] py-3.5 last:border-0 dark:border-white/5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#f1f7f5] text-foreground dark:bg-white/5">
                <CupSoda className="size-[18px]" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {v.place}
              </span>
            </div>
            <span className="text-primary text-sm font-bold">{v.reward}</span>
          </div>
        ))}
        <div className="flex justify-center py-3.5">
          <button type="button" className="text-primary text-sm font-semibold">
            {t("seeAllHistory")}
          </button>
        </div>
      </div>
    </section>
  );
}
