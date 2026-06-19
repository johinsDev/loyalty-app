import { CupSoda } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { visits } from "../data";

export async function RecentVisits() {
  const t = await getTranslations("Home");
  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("recentVisits")}
      </p>
      <div className="bg-card rounded-3xl px-4 py-1.5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {visits.map((v) => (
          <div
            key={v.id}
            className="border-border flex items-center justify-between border-b py-3.5 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
                <CupSoda className="size-4" />
              </span>
              <span className="text-foreground text-sm font-semibold">
                {v.place}
              </span>
            </div>
            <span className="text-primary text-sm font-bold">{v.reward}</span>
          </div>
        ))}
        <div className="flex justify-center py-3.5">
          <Link
            href="/history"
            className="text-primary text-sm font-semibold"
          >
            {t("seeAllHistory")}
          </Link>
        </div>
      </div>
    </section>
  );
}
