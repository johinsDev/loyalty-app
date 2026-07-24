import type { CampaignListItem } from "@loyalty/api/features/campaigns/schemas";
import { formatDate } from "@loyalty/date";
import { Badge } from "@loyalty/ui";
import { getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  RowCheckbox,
  SelectAllCheckbox,
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { trpc } from "@/lib/trpc/server";

import { STATE_STYLE } from "../columns";
import { buildCampaignsInput, loadCampaignsSearchParams } from "../list-params";
import { CampaignGridCard } from "./campaign-grid-card";
import { CampaignNameCell } from "./campaign-name-cell";
import { CampaignRowActions } from "./campaign-row-actions";
import { ChannelIcons } from "./channel-icons";

/**
 * Server-rendered campaigns table — the dynamic Suspense hole. Reads the URL
 * params, runs `campaigns.adminList` on the server and streams the rows.
 * Interactive cells (checkbox, name→`?detalle` quick-view, the ⋯ row menu) are
 * client islands.
 */
export async function CampaignsTable({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Campaigns");
  const locale = await getLocale();

  const loaded = loadCampaignsSearchParams(searchParams);
  const input = buildCampaignsInput(loaded);
  const data = await (await trpc()).campaigns.adminList(input);
  const rowIds = data.rows.map((c) => c.id);

  const columns: ServerColumn<CampaignListItem>[] = [
    {
      id: "select",
      hideable: false,
      width: 44,
      header: <SelectAllCheckbox ids={rowIds} label={t("selectAll")} />,
      cell: (c) => <RowCheckbox id={c.id} label={t("selectRow")} />,
    },
    {
      id: "name",
      label: t("colName"),
      header: <ServerSortHeader columnId="name" title={t("colName")} />,
      cell: (c) => (
        <CampaignNameCell id={c.id} name={c.name} namePlaceholder={t("namePlaceholder")} />
      ),
    },
    {
      id: "type",
      label: t("colType"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("colType")}</span>,
      cell: (c) => <Badge variant="outline">{t(`type.${c.type}`)}</Badge>,
    },
    {
      id: "displayState",
      label: t("colState"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("colState")}</span>,
      cell: (c) => (
        <Badge className={`border-0 ${STATE_STYLE[c.displayState]}`}>
          {t(`state.${c.displayState}`)}
        </Badge>
      ),
    },
    {
      id: "channelPriority",
      label: t("colChannels"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("colChannels")}</span>,
      cell: (c) => <ChannelIcons channels={c.channelPriority} />,
    },
    {
      id: "sent",
      label: t("colSent"),
      header: <ServerSortHeader columnId="sent" title={t("colSent")} />,
      cell: (c) =>
        c.sent > 0 ? (
          <span className="font-semibold">{c.sent.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "createdAt",
      label: t("colCreated"),
      header: <ServerSortHeader columnId="createdAt" title={t("colCreated")} />,
      cell: (c) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(c.createdAt, { locale })}
        </span>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("edit")}</span>,
      cell: (c) => <CampaignRowActions campaign={c} />,
    },
  ];

  const empty = (
    <div className="text-muted-foreground grid h-40 place-items-center px-6 text-center">
      <div>
        <p className="text-foreground font-semibold">{t("empty")}</p>
        <p className="mt-1 text-sm">{t("emptyHint")}</p>
      </div>
    </div>
  );

  return (
    <>
      {loaded.view === "grid" ? (
        data.rows.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((c) => (
              <CampaignGridCard key={c.id} campaign={c} />
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={loaded.cols}
          getRowId={(c) => c.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
