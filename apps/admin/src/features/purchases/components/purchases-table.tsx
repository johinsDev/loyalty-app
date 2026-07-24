import type { PurchaseAdminListItem } from "@loyalty/api/features/purchases/schemas";
import { formatDate } from "@loyalty/date";
import { Badge } from "@loyalty/ui";
import { Gift, Tag } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  RowCheckbox,
  SelectAllCheckbox,
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { Link } from "@/i18n/nav";
import { money } from "@/lib/money";
import { trpc } from "@/lib/trpc/server";

import { buildPurchasesInput, loadPurchasesSearchParams } from "../list-params";
import { PurchaseRowActions } from "./purchase-row-actions";

/**
 * Server-rendered purchases table — the dynamic Suspense hole. Reads the URL
 * params, hard-filters to the active store (`storeId`), runs `purchases.adminList`
 * on the server and streams the rows. Interactive cells (checkbox, name→detail
 * Link, the ⋯ row menu) are client islands.
 */
export async function PurchasesTable({
  searchParams,
  storeId,
}: {
  searchParams: SearchParams;
  storeId: string | null;
}) {
  const t = await getTranslations("Purchases");
  const format = await getFormatter();
  const locale = await getLocale();

  const loaded = loadPurchasesSearchParams(searchParams);
  const input = buildPurchasesInput(storeId ? { ...loaded, store: [storeId] } : loaded);
  const data = await (await trpc()).purchases.adminList(input);
  const rowIds = data.rows.map((r) => r.id);
  const initials = (p: PurchaseAdminListItem) =>
    (p.customerName ?? p.customerPhone).slice(0, 2).toUpperCase();

  const columns: ServerColumn<PurchaseAdminListItem>[] = [
    {
      id: "select",
      hideable: false,
      width: 44,
      header: <SelectAllCheckbox ids={rowIds} label={t("selectAll")} />,
      cell: (p) => <RowCheckbox id={p.id} label={t("selectRow")} />,
    },
    {
      id: "createdAt",
      label: t("col.date"),
      header: <ServerSortHeader columnId="createdAt" title={t("col.date")} />,
      cell: (p) => (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {formatDate(p.createdAt, { locale })}
        </span>
      ),
    },
    {
      id: "customerName",
      label: t("col.customer"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.customer")}</span>,
      cell: (p) => (
        <Link
          href={{ pathname: "/purchases/[id]", params: { id: p.id } }}
          className="hover:text-primary flex items-center gap-2.5 hover:underline"
        >
          <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
            {initials(p)}
          </span>
          <span
            className={`truncate font-semibold ${p.voidedAt ? "text-muted-foreground line-through" : ""}`}
          >
            {p.customerName || p.customerPhone}
          </span>
        </Link>
      ),
    },
    {
      id: "flags",
      label: t("col.flags"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.flags")}</span>,
      cell: (p) => (
        <div className="flex items-center gap-1">
          {p.voidedAt ? <Badge variant="destructive">{t("voided")}</Badge> : null}
          {p.hasPromo ? (
            <Badge variant="secondary" className="gap-1">
              <Tag className="size-3" />
              {t("badgePromo")}
            </Badge>
          ) : null}
          {p.hasReward ? (
            <Badge variant="secondary" className="gap-1">
              <Gift className="size-3" />
              {t("badgeReward")}
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "itemSummary",
      label: t("col.detail"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.detail")}</span>,
      cell: (p) =>
        p.itemSummary ? (
          <span className="text-muted-foreground text-sm">{p.itemSummary}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "storeName",
      label: t("col.store"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.store")}</span>,
      cell: (p) =>
        p.storeName ? (
          <Badge variant="outline">{p.storeName}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "cashierName",
      label: t("col.cashier"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.cashier")}</span>,
      cell: (p) => <span className="text-muted-foreground text-sm">{p.cashierName ?? "—"}</span>,
    },
    {
      id: "discountCents",
      align: "right",
      label: t("col.discount"),
      header: <ServerSortHeader columnId="discountCents" title={t("col.discount")} align="right" />,
      cell: (p) =>
        p.discountCents > 0 ? (
          <span className="text-primary text-sm font-semibold">
            −{money(format, p.discountCents, p.currency)}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      id: "totalCents",
      align: "right",
      label: t("col.amount"),
      header: <ServerSortHeader columnId="totalCents" title={t("col.amount")} align="right" />,
      cell: (p) => (
        <span
          className={`font-bold whitespace-nowrap ${p.voidedAt ? "text-muted-foreground line-through" : ""}`}
        >
          {money(format, p.totalCents, p.currency)}
        </span>
      ),
    },
    {
      id: "stampsEarned",
      align: "right",
      label: t("col.stamps"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.stamps")}</span>,
      cell: (p) => {
        if (p.stampsEarned <= 0) return <span className="text-muted-foreground text-sm">—</span>;
        const voided = p.voidedAt != null;
        return (
          <span
            title={voided ? t("col.reverted") : undefined}
            className={`text-sm font-semibold ${voided ? "text-muted-foreground" : ""}`}
          >
            {voided ? `↩ ${p.stampsEarned}` : `+${p.stampsEarned}`}
          </span>
        );
      },
    },
    {
      id: "pointsEarned",
      align: "right",
      label: t("col.points"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.points")}</span>,
      cell: (p) => {
        if (p.pointsEarned <= 0) return <span className="text-muted-foreground text-sm">—</span>;
        const voided = p.voidedAt != null;
        return (
          <span
            title={voided ? t("col.reverted") : undefined}
            className={`text-sm font-semibold ${voided ? "text-muted-foreground" : "text-emerald-600"}`}
          >
            {voided ? `↩ ${p.pointsEarned}` : `+${p.pointsEarned}`}
          </span>
        );
      },
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (p) => <PurchaseRowActions id={p.id} />,
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
              <Link
                key={p.id}
                href={{ pathname: "/purchases/[id]", params: { id: p.id } }}
                className="bg-card border-border hover:border-primary/40 block rounded-3xl border p-4 shadow-sm transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
                    {initials(p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.customerName || p.customerPhone}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {p.itemSummary ?? "—"}
                    </div>
                  </div>
                  {p.storeName ? <Badge variant="outline">{p.storeName}</Badge> : null}
                </div>
                <div className="border-border mt-4 flex items-end justify-between border-t pt-4">
                  <div>
                    <div className="font-display text-2xl font-semibold tracking-tight">
                      {money(format, p.totalCents, p.currency)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDate(p.createdAt, { locale })}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">
                    +{p.pointsEarned} {t("col.points")}
                  </span>
                </div>
              </Link>
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
