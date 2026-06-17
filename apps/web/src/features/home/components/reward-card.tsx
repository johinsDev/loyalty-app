import { Button } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { readyReward } from "../data";

export async function RewardCard() {
  const t = await getTranslations("Home");
  const { title, meta, icon: Icon } = readyReward;
  return (
    <div className="bg-card flex items-center gap-3.5 rounded-3xl p-4 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <span className="bg-primary/10 text-primary grid size-14 flex-none place-items-center rounded-2xl">
        <Icon className="size-7" />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-foreground text-base font-bold">{title}</span>
        <span className="text-muted-foreground text-sm">{meta}</span>
      </div>
      <Button className="h-9 rounded-full px-5 text-sm font-bold">
        {t("redeem")}
      </Button>
    </div>
  );
}
