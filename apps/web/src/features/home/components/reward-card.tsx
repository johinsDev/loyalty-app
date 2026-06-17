import { Button } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { readyReward } from "../data";

export async function RewardCard() {
  const t = await getTranslations("Home");
  const { title, meta, icon: Icon } = readyReward;
  return (
    <div className="bg-card flex items-center gap-3.5 rounded-3xl p-4 shadow-[0_12px_28px_-20px_rgba(0,3,35,.35)]">
      <span className="text-primary grid size-[54px] flex-none place-items-center rounded-[18px] bg-gradient-to-br from-[#f1fffb] to-[#d6f6ed]">
        <Icon className="size-7" />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-bold text-foreground">{title}</span>
        <span className="text-muted-foreground text-[13px]">{meta}</span>
      </div>
      <Button className="h-9 rounded-full px-5 text-[13px] font-bold">
        {t("redeem")}
      </Button>
    </div>
  );
}
