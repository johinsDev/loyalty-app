"use client";

import type { CampaignListItem } from "@loyalty/api/features/campaigns/schemas";
import { formatDate } from "@loyalty/date";
import { Badge } from "@loyalty/ui";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { RowCheckbox } from "@/components/data-table";

import { STATE_STYLE } from "../columns";
import { CampaignRowActions } from "./campaign-row-actions";
import { ChannelIcons } from "./channel-icons";

/**
 * Grid card for the server campaigns table — a client island so the whole card
 * can open the `?detalle=<id>` quick-view, while the ⋯ menu and checkbox stop
 * propagation. Markup mirrors the old grid renderer exactly.
 */
export function CampaignGridCard({ campaign }: { campaign: CampaignListItem }) {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const [, setDetailId] = useQueryState("detalle", parseAsString);

  return (
    <div
      role="button"
      tabIndex={0}
      className="bg-card border-border hover:border-primary/40 flex cursor-pointer flex-col rounded-3xl border p-5 shadow-sm transition-colors"
      onClick={() => void setDetailId(campaign.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void setDetailId(campaign.id);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{campaign.name || t("namePlaceholder")}</p>
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <CampaignRowActions campaign={campaign} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge className={`border-0 ${STATE_STYLE[campaign.displayState]}`}>
          {t(`state.${campaign.displayState}`)}
        </Badge>
        <Badge variant="outline">{t(`type.${campaign.type}`)}</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <ChannelIcons channels={campaign.channelPriority} />
        <span className="text-muted-foreground text-xs font-semibold">
          {campaign.sent > 0
            ? t("sentN", { n: campaign.sent })
            : formatDate(campaign.createdAt, { locale })}
        </span>
      </div>
      <div className="mt-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <RowCheckbox id={campaign.id} label={t("selectRow")} />
      </div>
    </div>
  );
}
