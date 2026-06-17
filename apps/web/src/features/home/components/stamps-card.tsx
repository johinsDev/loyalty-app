import { CupSoda, Gift } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { stampsWallet } from "../data";

/**
 * Stamp wallet — a 5×2 grid where every Nth stamp is a free drink. A clean white
 * card so it reads distinct from the mint points card ({@link PointsCard}).
 */
export async function StampsCard() {
  const t = await getTranslations("Home");
  const { filled, total, remaining } = stampsWallet;
  const stamps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <section className="bg-card rounded-3xl p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-foreground text-xl font-semibold tracking-tight">
          {t("stampsTitle")}
        </span>
        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold whitespace-nowrap">
          {t("stampsCount", { filled, total })}
        </span>
      </div>
      <p className="text-primary mb-4 text-sm font-semibold">
        {t("stampsRemaining", { count: remaining })}
      </p>
      <div className="grid grid-cols-5 gap-3">
        {stamps.map((n) => {
          if (n === total) {
            return (
              <div
                key={n}
                className="grid aspect-square place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-400 text-white shadow-md shadow-amber-400/40"
              >
                <Gift className="size-5" />
              </div>
            );
          }
          if (n <= filled) {
            return (
              <div
                key={n}
                className="bg-primary grid aspect-square place-items-center rounded-full text-white shadow-md shadow-primary/40"
              >
                <CupSoda className="size-5" />
              </div>
            );
          }
          return (
            <div
              key={n}
              className="border-primary/30 bg-primary/5 text-primary/50 grid aspect-square place-items-center rounded-full border-2 border-dashed text-xs font-bold"
            >
              {n}
            </div>
          );
        })}
      </div>
    </section>
  );
}
