import type { AppRouter } from "@loyalty/api";
import { Badge } from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { trpc } from "@/lib/trpc/server";

import { buildIngredientsInput, loadIngredientsSearchParams } from "../list-params";
import { IngredientRowActions } from "./ingredient-row-actions";

type IngredientRow = inferRouterOutputs<AppRouter>["ingredients"]["adminList"]["rows"][number];

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/** Server-rendered ingredients table. New surface: until now ingredients could
 *  only be created inline from the product editor, and never edited. */
export async function IngredientsTable({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("Ingredients");

  const values = loadIngredientsSearchParams(searchParams);
  const data = await (await trpc()).ingredients.adminList(buildIngredientsInput(values));

  const columns: ServerColumn<IngredientRow>[] = [
    {
      id: "name",
      label: t("col.name"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("col.name")} />,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{r.name}</span>
          {r.archivedAt ? (
            <Badge variant="secondary" className="text-muted-foreground">
              {t("archivedBadge")}
            </Badge>
          ) : null}
        </span>
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
      id: "unit",
      label: t("col.unit"),
      header: <ServerSortHeader columnId="unit" title={t("col.unit")} />,
      cell: (r) => (
        <span className="text-muted-foreground text-sm font-semibold">{r.unit}</span>
      ),
    },
    {
      id: "cost",
      label: t("col.cost"),
      align: "right",
      header: (
        <ServerSortHeader columnId="costPerUnitCents" title={t("col.cost")} align="right" />
      ),
      cell: (r) => (
        <span className="text-sm font-bold tabular-nums">
          {fmt(r.costPerUnitCents)}
          <span className="text-muted-foreground/70 ml-0.5 text-xs font-semibold">
            /{r.unit}
          </span>
        </span>
      ),
    },
    {
      id: "usage",
      label: t("col.usage"),
      align: "right",
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.usage")}</span>,
      cell: (r) => (
        <span className="text-muted-foreground text-sm font-semibold tabular-nums">
          {r.productCount > 0 ? t("usedIn", { n: r.productCount }) : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("edit")}</span>,
      cell: (r) => <IngredientRowActions ingredient={r} />,
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
