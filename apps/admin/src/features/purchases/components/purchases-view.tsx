"use client";

import {
  Badge,
  Button,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { Download, Receipt, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterSelect } from "@/components/filters";
import { type ViewMode, ViewToggle } from "@/components/view-toggle";
import { useFadeUp } from "@/lib/animate";

import {
  getReceipt,
  type Purchase,
  purchaseKpis,
  purchases,
  stores,
} from "../data";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Compras — KPI row + a transactions feed (search by customer, store filter,
 * list/grid toggle). Rows / cards open a Receipt modal with the line items and
 * totals. Design-first / hardcoded (../data); the seam is the tRPC
 * `compras.list` query (+ a receipt detail query) later.
 */
export function PurchasesView() {
  const t = useTranslations("Purchases");
  const tCommon = useTranslations("Common");
  const fade = useFadeUp({ step: 40 });

  const [query, setQuery] = useState("");
  const [store, setStore] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [active, setActive] = useState<Purchase | null>(null);

  const storeOptions: FilterOption<string>[] = stores.map((s) => ({
    value: s,
    label: s,
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchases.filter((p) => {
      if (store && p.store !== store) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, store]);

  const clearFilters = () => {
    setQuery("");
    setStore(null);
  };

  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <Button variant="outline" className="h-10 gap-2 rounded-xl">
          <Download className="size-4" />
          {t("export")}
        </Button>
      </div>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {purchaseKpis.map((k) => (
          <div
            key={k.key}
            style={fade(i++)}
            className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm"
          >
            <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
              {t(`kpi.${k.key}`)}
            </span>
            <div className="font-display mt-1 text-3xl font-semibold tracking-tight">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Feed card */}
      <div
        style={fade(i++)}
        className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm"
      >
        {/* Toolbar */}
        <div className="border-border flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-muted/40 placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              allLabel={t("statusFilter")}
              value={store}
              onValueChange={setStore}
              options={storeOptions}
            />
            <ViewToggle
              value={view}
              onValueChange={setView}
              ariaLabel={tCommon("viewToggle")}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t("empty")}
            hint={t("emptyHint")}
            action={
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={clearFilters}
              >
                {t("clearFilters")}
              </Button>
            }
          />
        ) : view === "list" ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("col.customer")}</TableHead>
                <TableHead>{t("col.detail")}</TableHead>
                <TableHead>{t("col.store")}</TableHead>
                <TableHead className="text-right">{t("col.amount")}</TableHead>
                <TableHead className="text-right">{t("col.points")}</TableHead>
                <TableHead>{t("col.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => setActive(p)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-full text-xs font-bold">
                        {p.initials}
                      </span>
                      <span className="truncate font-bold">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {p.item}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.store}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {money.format(p.amount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">
                    +{p.points}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-semibold">
                    {p.date}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                style={fade(i++)}
                className="bg-card border-border cursor-pointer rounded-3xl border p-5 shadow-sm"
                onClick={() => setActive(p)}
              >
                <div className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary grid size-11 flex-none place-items-center rounded-full text-sm font-bold">
                    {p.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{p.name}</div>
                    <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                      {p.item}
                    </div>
                  </div>
                  <Badge variant="secondary">{p.store}</Badge>
                </div>

                <div className="border-border mt-4 flex items-end justify-between border-t pt-4">
                  <div>
                    <div className="font-display text-2xl font-semibold tracking-tight">
                      {money.format(p.amount)}
                    </div>
                    <div className="text-muted-foreground/70 text-xs font-semibold">
                      {p.date}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">
                    +{p.points} {t("col.points")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReceiptModal
        purchase={active}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
        t={t}
      />
    </div>
  );
}

function ReceiptModal({
  purchase,
  onOpenChange,
  t,
}: {
  purchase: Purchase | null;
  onOpenChange: (open: boolean) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const receipt = purchase ? getReceipt(purchase.id) : null;

  return (
    <ResponsiveModal open={purchase !== null} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{t("receipt")}</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        {purchase && receipt ? (
          <div className="flex flex-col gap-4 px-4 pb-2">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
                {purchase.initials}
              </span>
              <div className="min-w-0">
                <div className="truncate font-bold">{purchase.name}</div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {purchase.store} · {purchase.date}
                </div>
              </div>
            </div>

            <div>
              <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
                {t("items")}
              </span>
              <ul className="mt-2 flex flex-col gap-2">
                {receipt.items.map((line) => (
                  <li
                    key={line.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-semibold">
                      {line.qty}× {line.name}
                    </span>
                    <span className="font-bold">{money.format(line.price)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-border flex flex-col gap-1.5 border-t pt-3 text-sm">
              <div className="text-muted-foreground flex items-center justify-between font-semibold">
                <span>{t("subtotal")}</span>
                <span>{money.format(receipt.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>{t("total")}</span>
                <span className="font-display text-lg">
                  {money.format(receipt.total)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <ResponsiveModalFooter>
          <ResponsiveModalClose>{t("close")}</ResponsiveModalClose>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
