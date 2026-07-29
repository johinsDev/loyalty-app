import type { AppRouter } from "@loyalty/api";
import { Badge } from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { Link2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { trpc } from "@/lib/trpc/server";

import { buildAddonsInput, loadAddonsSearchParams } from "../list-params";
import { AddonRowActions } from "./addon-row-actions";

type AddonRow = inferRouterOutputs<AppRouter>["addons"]["adminList"]["rows"][number];

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Server-rendered add-ons table — the dynamic Suspense hole. Replaces the old
 * hand-rolled client list, which fetched a hard `limit(200)` with no pagination
 * and never wired the search the endpoint already accepted.
 */
export async function AddonsTable({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Addons");

  const values = loadAddonsSearchParams(searchParams);
  const data = await (await trpc()).addons.adminList(buildAddonsInput(values));

  const columns: ServerColumn<AddonRow>[] = [
    {
      id: "name",
      label: t("col.name"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("col.name")} />,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-semibold">{r.name}</div>
          {r.description ? (
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              {r.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "category",
      label: t("col.category"),
      header: (
        <span className="text-muted-foreground text-xs font-bold">{t("col.category")}</span>
      ),
      cell: (r) =>
        r.categoryName ? (
          <Badge variant="secondary">{r.categoryName}</Badge>
        ) : (
          <span className="text-muted-foreground text-sm font-semibold">—</span>
        ),
    },
    {
      id: "price",
      label: t("col.price"),
      align: "right",
      header: <ServerSortHeader columnId="priceDeltaCents" title={t("col.price")} align="right" />,
      cell: (r) => (
        <span className="text-sm font-bold tabular-nums">+{fmt(r.priceDeltaCents)}</span>
      ),
    },
    {
      id: "cost",
      label: t("col.cost"),
      align: "right",
      header: <ServerSortHeader columnId="costCents" title={t("col.cost")} align="right" />,
      cell: (r) => (
        <span className="text-muted-foreground text-sm font-semibold tabular-nums">
          {fmt(r.costCents)}
          {/* A derived cost comes from the linked ingredient's recipe, so it
              can't be edited here — mark it so the number isn't mistaken for
              a hand-typed one. */}
          {r.costIsDerived ? <span className="ml-1 text-[10px]">({t("derived")})</span> : null}
        </span>
      ),
    },
    {
      id: "ingredient",
      label: t("col.ingredient"),
      header: (
        <span className="text-muted-foreground text-xs font-bold">{t("col.ingredient")}</span>
      ),
      cell: (r) =>
        r.ingredientName ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="size-3.5 flex-none" />
            <span className="truncate">{r.ingredientName}</span>
            {r.ingredientQty != null ? (
              <span className="tabular-nums">
                · {r.ingredientQty} {r.ingredientUnit}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm font-semibold">—</span>
        ),
    },
    {
      id: "status",
      label: t("col.status"),
      header: <ServerSortHeader columnId="active" title={t("col.status")} />,
      cell: (r) => (
        <Badge
          variant="secondary"
          className={r.active ? "text-emerald-600" : "text-muted-foreground"}
        >
          {t(r.active ? "status.active" : "status.inactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("edit")}</span>,
      cell: (r) => <AddonRowActions addon={r} />,
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
      <ServerTable
        columns={columns}
        rows={data.rows}
        hiddenIds={values.cols}
        getRowId={(r) => r.id}
        emptyState={empty}
      />
      <ServerPagination pageCount={data.pageCount} total={data.total} />
    </>
  );
}
