import type { AdminPromoListRow, AdminPromoRow } from "@loyalty/api/features/promotions";
import { formatDate } from "@loyalty/date";
import { Badge } from "@loyalty/ui";
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

import { buildPromotionsInput, loadPromotionsSearchParams, PROMO_TYPE_VALUES, PROMO_VIGENCY_VALUES } from "../list-params";
import { PromotionRowActions } from "./promotion-row-actions";

type Vigency = (typeof PROMO_VIGENCY_VALUES)[number];

/** Mirror of the server vigency facet (published-only). */
function vigencyOf(p: { status: string; startsAt: Date | null; endsAt: Date | null }): Vigency | null {
  if (p.status !== "published") return null;
  const now = new Date();
  if (p.startsAt && p.startsAt > now) return "scheduled";
  if (p.endsAt && p.endsAt < now) return "expired";
  return "active";
}

const VIGENCY_CLASS: Record<Vigency, string> = {
  active: "text-emerald-600",
  scheduled: "text-amber-600",
  expired: "text-muted-foreground",
};

/**
 * Server-rendered promotions table — the dynamic Suspense hole. Reads the URL
 * params, scopes to the active store (`storeId`), runs `promociones.adminList`
 * on the server and streams the rows. Interactive cells (name→detail Link, the
 * availability badge, the ⋯ row menu) are client islands.
 */
export async function PromotionsTable({
  searchParams,
  storeId,
}: {
  searchParams: SearchParams;
  storeId: string | null;
}) {
  const t = await getTranslations("Promotions");
  const locale = await getLocale();

  const loaded = loadPromotionsSearchParams(searchParams);
  const input = { ...buildPromotionsInput(loaded), storeId: storeId ?? undefined };
  const data = await (await trpc()).promociones.adminList(input);

  const typeLabel = (v: string | null) =>
    v && (PROMO_TYPE_VALUES as readonly string[]).includes(v) ? t(`types.${v}`) : "—";
  const statusBadge = (s: string) =>
    s === "published" ? (
      <Badge>{t("list.published")}</Badge>
    ) : s === "archived" ? (
      <Badge variant="secondary">{t("list.archived")}</Badge>
    ) : (
      <Badge variant="outline">{t("list.draft")}</Badge>
    );
  const vigencyCell = (p: AdminPromoRow) => {
    const v = vigencyOf(p);
    if (!v) return <span className="text-muted-foreground">—</span>;
    return <span className={`text-xs font-semibold ${VIGENCY_CLASS[v]}`}>{t(`list.${v}`)}</span>;
  };
  const windowLabel = (p: AdminPromoRow) => {
    if (!p.startsAt && !p.endsAt) return "—";
    const from = p.startsAt ? formatDate(p.startsAt, { locale }) : "—";
    const to = p.endsAt ? formatDate(p.endsAt, { locale }) : "—";
    return `${from} – ${to}`;
  };

  const columns: ServerColumn<AdminPromoListRow>[] = [
    {
      id: "name",
      label: t("list.colName"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("list.colName")} />,
      cell: (p) => (
        <Link
          href={{ pathname: "/promotions/[id]", params: { id: p.id } }}
          className="hover:text-primary flex items-center gap-2.5 hover:underline"
        >
          <span
            aria-hidden
            className="border-border size-7 shrink-0 rounded-lg border"
            style={{ background: p.backgroundCss ?? "var(--muted)" }}
          />
          <span className="font-semibold">{p.name || t("list.namePlaceholder")}</span>
          {/* A promo whose product was deleted can never apply again, and used
              to say nothing about it — the only way to find out was to build a
              cart and watch it not show up. */}
          {p.deadRefs > 0 ? (
            <span
              title={t("list.deadRefsHint")}
              className="flex-none rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[0.625rem] font-extrabold text-amber-700 dark:text-amber-400"
            >
              {t("list.deadRefs")}
            </span>
          ) : null}
        </Link>
      ),
    },
    {
      id: "type",
      label: t("list.colType"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("list.colType")}</span>,
      cell: (p) => <span className="text-muted-foreground text-sm">{typeLabel(p.type)}</span>,
    },
    {
      id: "status",
      label: t("list.colStatus"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("list.colStatus")}</span>,
      cell: (p) => statusBadge(p.status),
    },
    {
      id: "availability",
      label: t("list.colAvailability"),
      header: (
        <span className="text-muted-foreground text-xs font-bold">{t("list.colAvailability")}</span>
      ),
      cell: (p) => <StoreAvailabilityBadge storeIds={p.storeIds} />,
    },
    {
      id: "vigency",
      label: t("list.colVigency"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("list.colVigency")}</span>,
      cell: (p) => vigencyCell(p),
    },
    {
      id: "startsAt",
      label: t("list.colWindow"),
      header: <ServerSortHeader columnId="startsAt" title={t("list.colWindow")} />,
      cell: (p) => <span className="text-muted-foreground text-sm">{windowLabel(p)}</span>,
    },
    {
      id: "uses",
      label: t("list.colUses"),
      header: <ServerSortHeader columnId="uses" title={t("list.colUses")} />,
      cell: (p) => <span className="text-sm tabular-nums">{p.uses}</span>,
    },
    {
      id: "createdAt",
      label: t("list.colCreated"),
      header: <ServerSortHeader columnId="createdAt" title={t("list.colCreated")} />,
      cell: (p) => (
        <span className="text-muted-foreground text-sm">{formatDate(p.createdAt, { locale })}</span>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("list.open")}</span>,
      cell: (p) => (
        <PromotionRowActions promo={{ id: p.id, name: p.name, status: p.status, uses: p.uses }} />
      ),
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
            {data.rows.map((p) => (
              <div
                key={p.id}
                className="bg-card border-border hover:border-primary/40 relative flex flex-col overflow-hidden rounded-3xl border shadow-sm transition-colors"
              >
                <Link
                  href={{ pathname: "/promotions/[id]", params: { id: p.id } }}
                  className="flex flex-1 flex-col"
                >
                  <div className="relative h-24" style={{ background: p.backgroundCss ?? "var(--muted)" }}>
                    {p.badgeLabel ? (
                      <span className="absolute top-3 left-3 inline-flex rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                        {p.badgeLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{p.name || t("list.namePlaceholder")}</p>
                      {statusBadge(p.status)}
                    </div>
                    {p.shortDescription ? (
                      <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                        {p.shortDescription}
                      </p>
                    ) : null}
                    <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                      <span>{typeLabel(p.type)}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{t("list.usesCount", { n: p.uses })}</span>
                      {vigencyOf(p) ? (
                        <>
                          <span aria-hidden>·</span>
                          {vigencyCell(p)}
                        </>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <StoreAvailabilityBadge storeIds={p.storeIds} />
                    </div>
                  </div>
                </Link>
                <div className="absolute top-3 right-3 z-10">
                  <PromotionRowActions
                    promo={{ id: p.id, name: p.name, status: p.status, uses: p.uses }}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={loaded.cols}
          getRowId={(p) => p.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
