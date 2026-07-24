"use client";

import type { BannerListItem } from "@loyalty/api/features/banners/schemas";
import { Badge } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { RowCheckbox } from "@/components/data-table";
import { StoreAvailabilityBadge } from "@/features/stores/components/store-availability-badge";

import { STATE_STYLE } from "../columns";
import { BannerRowActions } from "./banner-row-actions";

/**
 * Grid card for the server banners table — a client island so the whole card
 * can open the `?detalle=<id>` quick-view, while the checkbox and ⋯ menu stop
 * propagation. Markup mirrors the old grid renderer exactly.
 */
export function BannerGridCard({ banner, schedule }: { banner: BannerListItem; schedule: string }) {
  const t = useTranslations("Banners");
  const [, setDetailId] = useQueryState("detalle", parseAsString);

  return (
    <div
      role="button"
      tabIndex={0}
      className="bg-card border-border hover:border-primary/40 flex cursor-pointer flex-col overflow-hidden rounded-3xl border shadow-sm transition-colors"
      onClick={() => void setDetailId(banner.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void setDetailId(banner.id);
        }
      }}
    >
      <div className="relative h-28" style={{ background: banner.backgroundCss ?? "var(--muted)" }}>
        <Badge className={`absolute top-3 left-3 border-0 ${STATE_STYLE[banner.displayState]}`}>
          {t(`state.${banner.displayState}`)}
        </Badge>
        <div
          className="absolute top-2 right-2 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="bg-card/80 rounded-lg backdrop-blur">
            <BannerRowActions banner={banner} />
          </div>
        </div>
        <div
          className="absolute bottom-2 left-3"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <RowCheckbox id={banner.id} label={t("selectRow")} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold">{banner.name || t("namePlaceholder")}</p>
        <p className="text-muted-foreground mt-0.5 font-mono text-xs">/{banner.slug}</p>
        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span>{schedule}</span>
          <StoreAvailabilityBadge storeIds={banner.storeIds} />
        </div>
      </div>
    </div>
  );
}
