import type { AdminRewardRow } from "@loyalty/api/features/rewards";
import { formatDate } from "@loyalty/date";
import { Badge, IconGlyph } from "@loyalty/ui";
import { getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { StoreAvailabilityBadge } from "@/features/stores/components/store-availability-badge";
import { Link } from "@/i18n/nav";
import { trpc } from "@/lib/trpc/server";

import { buildRewardsInput, loadRewardsSearchParams, REWARD_TYPE_VALUES } from "../list-params";
import { RewardRowActions } from "./reward-row-actions";

/**
 * Server-rendered rewards table — the dynamic Suspense hole. Reads the URL
 * params, scopes to the active store, runs `rewards.adminList` on the server and
 * streams the rows. Interactive cells (name→detail Link, the ⋯ row menu) are
 * client islands; everything else is plain server JSX.
 */
export async function RewardsTable({
  searchParams,
  storeId,
}: {
  searchParams: SearchParams;
  storeId: string | null;
}) {
  const t = await getTranslations("Rewards");
  const locale = await getLocale();

  const values = loadRewardsSearchParams(searchParams);
  const input = { ...buildRewardsInput(values), storeId: storeId ?? undefined };
  const data = await (await trpc()).rewards.adminList(input);

  const typeLabel = (v: string | null) =>
    v && (REWARD_TYPE_VALUES as readonly string[]).includes(v) ? t(`types.${v}`) : "—";
  const statusBadge = (s: string) =>
    s === "published" ? (
      <Badge>{t("list.published")}</Badge>
    ) : s === "archived" ? (
      <Badge variant="secondary">{t("list.archived")}</Badge>
    ) : (
      <Badge variant="outline">{t("list.draft")}</Badge>
    );
  const costLabel = (r: AdminRewardRow) => {
    const parts: string[] = [];
    if (r.stampsRequired != null) parts.push(t("cost.stamps", { n: r.stampsRequired }));
    if (r.pointsCost != null) parts.push(t("cost.points", { n: r.pointsCost }));
    if (parts.length === 0) return "—";
    return parts.join(r.costMode === "and" ? t("cost.and") : t("cost.or"));
  };
  const rowActions = (r: AdminRewardRow) =>
    ({ id: r.id, name: r.name, status: r.status, redemptions: r.redemptions });

  const columns: ServerColumn<AdminRewardRow>[] = [
    {
      id: "name",
      label: t("list.colName"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("list.colName")} />,
      cell: (r) => (
        <Link
          href={{ pathname: "/rewards/[id]", params: { id: r.id } }}
          className="hover:text-primary flex items-center gap-2.5 hover:underline"
        >
          <span
            aria-hidden
            className="border-border grid size-7 shrink-0 place-items-center rounded-lg border text-sm text-white"
            style={{ background: r.backgroundCss ?? "var(--muted)" }}
          >
            {r.icon ? <IconGlyph value={r.icon} /> : null}
          </span>
          <span className="font-semibold">{r.name || t("list.namePlaceholder")}</span>
          <StoreAvailabilityBadge storeIds={r.storeIds} />
        </Link>
      ),
    },
    {
      id: "type",
      label: t("list.colType"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("list.colType")}</span>,
      cell: (r) => <span className="text-muted-foreground text-sm">{typeLabel(r.type)}</span>,
    },
    {
      id: "status",
      label: t("list.colStatus"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("list.colStatus")}</span>,
      cell: (r) => statusBadge(r.status),
    },
    {
      id: "cost",
      label: t("list.colCost"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("list.colCost")}</span>,
      cell: (r) => <span className="text-primary text-sm font-semibold">{costLabel(r)}</span>,
    },
    {
      id: "redemptions",
      label: t("list.colRedemptions"),
      header: <ServerSortHeader columnId="redemptions" title={t("list.colRedemptions")} />,
      cell: (r) => <span className="text-sm tabular-nums">{r.redemptions}</span>,
    },
    {
      id: "createdAt",
      label: t("list.colCreated"),
      header: <ServerSortHeader columnId="createdAt" title={t("list.colCreated")} />,
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(r.createdAt, { locale })}
        </span>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("list.open")}</span>,
      cell: (r) => <RewardRowActions reward={rowActions(r)} />,
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
      {values.view === "grid" ? (
        data.rows.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.rows.map((r) => (
              <div
                key={r.id}
                className="bg-card border-border hover:border-primary/40 flex flex-col overflow-hidden rounded-3xl border shadow-sm transition-colors"
              >
                <div
                  className="relative flex h-24 items-center justify-center text-4xl text-white"
                  style={{ background: r.backgroundCss ?? "var(--muted)" }}
                >
                  {r.icon ? <IconGlyph value={r.icon} /> : null}
                  <div className="absolute top-3 right-3">
                    <RewardRowActions reward={rowActions(r)} />
                  </div>
                </div>
                <Link
                  href={{ pathname: "/rewards/[id]", params: { id: r.id } }}
                  className="flex flex-1 flex-col p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{r.name || t("list.namePlaceholder")}</p>
                    {statusBadge(r.status)}
                  </div>
                  <div className="mt-2">
                    <StoreAvailabilityBadge storeIds={r.storeIds} />
                  </div>
                  <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                    <span>{typeLabel(r.type)}</span>
                    <span aria-hidden>·</span>
                    <span className="text-primary font-semibold">{costLabel(r)}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {t("list.redemptionsCount", { n: r.redemptions })}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={values.cols}
          getRowId={(r) => r.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
