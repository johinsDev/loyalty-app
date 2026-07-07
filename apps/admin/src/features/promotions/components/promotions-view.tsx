"use client";

import type { AdminPromoRow } from "@loyalty/api/features/promotions";
import type { AdminListInput } from "@loyalty/api/features/promotions/schemas";
import { formatDate, localeFromCode } from "@loyalty/date";
import { Badge, Button, Calendar, Checkbox, Input } from "@loyalty/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { parseAsArrayOf, parseAsIsoDate, parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import {
  DataTable,
  DataTableColumnHeader,
  DataTableFilters,
  DataTablePagination,
  DataTableSortList,
  DataTableViewOptions,
  FilterSection,
  tableParsers,
} from "@/components/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { ViewToggle } from "@/components/view-toggle";
import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import {
  buildPromotionsInput,
  PROMO_AUDIENCE_VALUES,
  PROMO_STATUS_VALUES,
  PROMO_TYPE_VALUES,
  PROMO_VIGENCY_VALUES,
} from "../list-params";
import { PromotionRowActions } from "./promotion-row-actions";

type PromoListResult = { rows: AdminPromoRow[]; total: number; pageCount: number };

type Vigency = (typeof PROMO_VIGENCY_VALUES)[number];

/** Client-side mirror of the server vigency facet (published-only). */
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

export function PromotionsView({ initialData }: { initialData?: PromoListResult }) {
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();

  // ── Feature-specific URL state (facets + q). page/perPage/sort/view/cols live
  //    in useDataTable. ───────────────────────────────────────────────────────
  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [vigency, setVigency] = useQueryState("vigency", parseAsArrayOf(parseAsString).withDefault([]));
  const [type, setType] = useQueryState("type", parseAsArrayOf(parseAsString).withDefault([]));
  const [audience, setAudience] = useQueryState(
    "audience",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [startsFrom, setStartsFrom] = useQueryState("startsFrom", parseAsIsoDate);
  const [startsTo, setStartsTo] = useQueryState("startsTo", parseAsIsoDate);
  const [page, setPage] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [view, setView] = useQueryState("view", tableParsers.view);

  const resetPage = () => void setPage(1);

  // Local search box (debounced into the URL `q`).
  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void setQ(value || null);
      resetPage();
    }, 350);
  };

  // Count only facets that actually narrow the list (all boxes checked = all).
  const narrows = (values: string[], all: readonly string[]) =>
    values.length > 0 && values.length < all.length ? 1 : 0;
  const activeFacets =
    narrows(status, PROMO_STATUS_VALUES) +
    narrows(vigency, PROMO_VIGENCY_VALUES) +
    narrows(type, PROMO_TYPE_VALUES) +
    narrows(audience, PROMO_AUDIENCE_VALUES) +
    (startsFrom || startsTo ? 1 : 0);
  const clearFilters = () => {
    void setStatus([]);
    void setVigency([]);
    void setType([]);
    void setAudience([]);
    void setStartsFrom(null);
    void setStartsTo(null);
    resetPage();
  };
  const toggle = (values: string[], set: (next: string[]) => void) => (v: string) => {
    set(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    resetPage();
  };
  const toggleStatus = toggle(status, (next) => void setStatus(next));
  const toggleVigency = toggle(vigency, (next) => void setVigency(next));
  const toggleType = toggle(type, (next) => void setType(next));
  const toggleAudience = toggle(audience, (next) => void setAudience(next));

  const input: AdminListInput = useMemo(
    () =>
      buildPromotionsInput({ q, page, perPage, sort, status, vigency, type, audience, startsFrom, startsTo }),
    [q, page, perPage, sort, status, vigency, type, audience, startsFrom, startsTo],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.promociones.adminList.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const openDetail = (id: string) =>
    router.push({ pathname: "/promotions/[id]", params: { id } });

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

  const columns = useMemo<ColumnDef<AdminPromoRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: t("list.colName") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.colName")} />,
        cell: ({ row }) => (
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="border-border size-7 shrink-0 rounded-lg border"
              style={{ background: row.original.backgroundCss ?? "var(--muted)" }}
            />
            <span className="font-semibold">{row.original.name || t("list.namePlaceholder")}</span>
          </span>
        ),
      },
      {
        accessorKey: "type",
        enableSorting: false,
        meta: { label: t("list.colType") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("list.colType")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{typeLabel(row.original.type)}</span>
        ),
      },
      {
        accessorKey: "status",
        enableSorting: false,
        meta: { label: t("list.colStatus") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("list.colStatus")}</span>,
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: "vigency",
        enableSorting: false,
        meta: { label: t("list.colVigency") },
        header: () => (
          <span className="text-muted-foreground text-xs font-bold">{t("list.colVigency")}</span>
        ),
        cell: ({ row }) => vigencyCell(row.original),
      },
      {
        accessorKey: "startsAt",
        meta: { label: t("list.colWindow") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.colWindow")} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{windowLabel(row.original)}</span>
        ),
      },
      {
        accessorKey: "uses",
        meta: { label: t("list.colUses") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.colUses")} />,
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.uses}</span>,
      },
      {
        accessorKey: "createdAt",
        meta: { label: t("list.colCreated") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.colCreated")} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(row.original.createdAt, { locale })}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <PromotionRowActions promo={row.original} />
          </div>
        ),
      },
    ],
    [t, locale],
  );

  const { table, selectedIds } = useDataTable<AdminPromoRow>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/promotions/new")}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {/* Toolbar — search + a Filters drawer; only Sort/View/toggle stay inline. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full sm:w-64"
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("list.colStatus")}>
            {PROMO_STATUS_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={status.includes(v)} onCheckedChange={() => toggleStatus(v)} />
                {t(`list.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("list.colVigency")}>
            {PROMO_VIGENCY_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={vigency.includes(v)} onCheckedChange={() => toggleVigency(v)} />
                {t(`list.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("list.colType")}>
            {PROMO_TYPE_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={type.includes(v)} onCheckedChange={() => toggleType(v)} />
                {t(`types.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("fieldAudience")}>
            {PROMO_AUDIENCE_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={audience.includes(v)} onCheckedChange={() => toggleAudience(v)} />
                {t(`audience.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("start")}>
            <div className="border-border flex justify-center rounded-2xl border p-1.5">
              <Calendar
                mode="range"
                className="[--cell-size:--spacing(9)]"
                locale={localeFromCode(locale)}
                selected={{ from: startsFrom ?? undefined, to: startsTo ?? undefined }}
                onSelect={(r: { from?: Date; to?: Date } | undefined) => {
                  void setStartsFrom(r?.from ?? null);
                  void setStartsTo(r?.to ?? null);
                  resetPage();
                }}
              />
            </div>
            {startsFrom || startsTo ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => {
                  void setStartsFrom(null);
                  void setStartsTo(null);
                  resetPage();
                }}
              >
                {t("list.clearDate")}
              </Button>
            ) : null}
          </FilterSection>
        </DataTableFilters>
        <div className="ml-auto flex items-center gap-2">
          <DataTableSortList table={table} />
          <DataTableViewOptions table={table} />
          <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("list.viewToggle")} />
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          table={table}
          view={view}
          isFetching={query.isFetching}
          onRowClick={(p) => openDetail(p.id)}
          emptyState={
            <div className="text-muted-foreground grid h-40 place-items-center px-6 text-center">
              <div>
                <p className="text-foreground font-semibold">{t("empty")}</p>
                <p className="mt-1 text-sm">{t("emptyHint")}</p>
              </div>
            </div>
          }
          renderGrid={(items) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  className="bg-card border-border hover:border-primary/40 flex cursor-pointer flex-col overflow-hidden rounded-3xl border shadow-sm transition-colors"
                  onClick={() => openDetail(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(p.id);
                    }
                  }}
                >
                  <div
                    className="relative h-24"
                    style={{ background: p.backgroundCss ?? "var(--muted)" }}
                  >
                    {p.badgeLabel ? (
                      <span className="absolute top-3 left-3 inline-flex rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                        {p.badgeLabel}
                      </span>
                    ) : null}
                    <div
                      className="absolute top-3 right-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <PromotionRowActions promo={p} />
                    </div>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        />
        <DataTablePagination table={table} total={total} selectedCount={selectedIds.length} />
      </div>
    </div>
  );
}
