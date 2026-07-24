import type { BannerListItem } from "@loyalty/api/features/banners/schemas";
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
import { StoreAvailabilityBadge } from "@/features/stores/components/store-availability-badge";
import { trpc } from "@/lib/trpc/server";

import { STATE_STYLE } from "../columns";
import { buildBannersInput, loadBannersSearchParams } from "../list-params";
import { BannerGridCard } from "./banner-grid-card";
import { BannerNameCell } from "./banner-name-cell";
import { BannerRowActions } from "./banner-row-actions";

/**
 * Server-rendered banners table — the dynamic Suspense hole. Reads the URL
 * params, scopes to the active store (`storeId`), runs `banners.adminList` on the
 * server and streams the rows. Interactive cells (checkbox, name→`?detalle`
 * quick-view, the ⋯ row menu) are client islands. The `stores` column is only
 * shown for multi-store orgs.
 */
export async function BannersTable({
  searchParams,
  storeId,
  multiStore,
}: {
  searchParams: SearchParams;
  storeId: string | null;
  multiStore: boolean;
}) {
  const t = await getTranslations("Banners");
  const locale = await getLocale();

  const loaded = loadBannersSearchParams(searchParams);
  const input = { ...buildBannersInput(loaded), storeId: storeId ?? undefined };
  const data = await (await trpc()).banners.adminList(input);
  const rowIds = data.rows.map((b) => b.id);

  const scheduleLabel = (b: BannerListItem): string => {
    const f = b.displayFrom ? formatDate(b.displayFrom, { locale }) : null;
    const u = b.displayUntil ? formatDate(b.displayUntil, { locale }) : null;
    if (!f && !u) return t("scheduleAlways");
    return `${f ?? "—"} → ${u ?? "∞"}`;
  };

  const columns: ServerColumn<BannerListItem>[] = [
    {
      id: "select",
      hideable: false,
      width: 44,
      header: <SelectAllCheckbox ids={rowIds} label={t("selectAll")} />,
      cell: (b) => <RowCheckbox id={b.id} label={t("selectRow")} />,
    },
    {
      id: "name",
      label: t("colName"),
      header: <ServerSortHeader columnId="name" title={t("colName")} />,
      cell: (b) => (
        <BannerNameCell
          id={b.id}
          name={b.name}
          namePlaceholder={t("namePlaceholder")}
          backgroundCss={b.backgroundCss}
        />
      ),
    },
    {
      id: "slug",
      label: t("colSlug"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("colSlug")}</span>,
      cell: (b) => <span className="text-muted-foreground font-mono text-xs">/{b.slug}</span>,
    },
    {
      id: "displayState",
      label: t("colState"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("colState")}</span>,
      cell: (b) => (
        <Badge className={`border-0 ${STATE_STYLE[b.displayState]}`}>
          {t(`state.${b.displayState}`)}
        </Badge>
      ),
    },
    ...(multiStore
      ? [
          {
            id: "stores",
            label: t("colStores"),
            header: (
              <span className="text-muted-foreground text-xs font-bold">{t("colStores")}</span>
            ),
            cell: (b: BannerListItem) => <StoreAvailabilityBadge storeIds={b.storeIds} />,
          } satisfies ServerColumn<BannerListItem>,
        ]
      : []),
    {
      id: "displayFrom",
      label: t("colSchedule"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("colSchedule")}</span>,
      cell: (b) => <span className="text-muted-foreground text-sm">{scheduleLabel(b)}</span>,
    },
    {
      id: "createdAt",
      label: t("colCreated"),
      header: <ServerSortHeader columnId="createdAt" title={t("colCreated")} />,
      cell: (b) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(b.createdAt, { locale })}
        </span>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("edit")}</span>,
      cell: (b) => <BannerRowActions banner={b} />,
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
            {data.rows.map((b) => (
              <BannerGridCard key={b.id} banner={b} schedule={scheduleLabel(b)} />
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={loaded.cols}
          getRowId={(b) => b.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
