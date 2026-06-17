import { CupSoda, Gift } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { stampsWallet } from "../data";

/**
 * Stamp wallet — a 5×2 grid where every Nth stamp is a free drink. The other
 * wallet model the home showcases next to {@link PointsCard}.
 */
export async function StampsCard() {
  const t = await getTranslations("Home");
  const { filled, total, remaining } = stampsWallet;
  const stamps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <section className="rounded-[30px] bg-gradient-to-br from-[#eafff8] to-[#d6f6ed] p-6 shadow-[0_20px_44px_-22px_rgba(27,173,157,.5)]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-[21px] font-semibold tracking-tight text-foreground">
          {t("stampsTitle")}
        </span>
        <span className="bg-card text-primary rounded-full px-3 py-1 text-[13px] font-extrabold whitespace-nowrap shadow-[0_4px_10px_-6px_rgba(0,3,35,.2)]">
          {t("stampsCount", { filled, total })}
        </span>
      </div>
      <p className="mb-4 text-sm font-semibold text-[#3f7d72]">
        {t("stampsRemaining", { count: remaining })}
      </p>
      <div className="grid grid-cols-5 gap-3">
        {stamps.map((n) => {
          if (n === total) {
            return (
              <div
                key={n}
                className="grid aspect-square place-items-center rounded-full bg-gradient-to-br from-[#ffd36e] to-[#ffb84d] text-white shadow-[0_8px_16px_-8px_rgba(255,170,60,.7)]"
              >
                <Gift className="size-5" />
              </div>
            );
          }
          if (n <= filled) {
            return (
              <div
                key={n}
                className="bg-primary grid aspect-square place-items-center rounded-full text-white shadow-[0_6px_14px_-8px_rgba(27,173,157,.8)]"
              >
                <CupSoda className="size-5" />
              </div>
            );
          }
          return (
            <div
              key={n}
              className="grid aspect-square place-items-center rounded-full border-2 border-dashed border-[#b8ddd3] bg-white/65 text-[13px] font-bold text-[#9bc6bb]"
            >
              {n}
            </div>
          );
        })}
      </div>
    </section>
  );
}
