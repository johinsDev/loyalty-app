"use client";

import { ResponsiveModal, ResponsiveModalContent } from "@loyalty/ui";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useMemo } from "react";

import { CountUp } from "@/lib/count-up";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import {
  type Order,
  type Period,
  groupByDay,
  monthSummary,
  orderById,
  orderSummary,
  ordersForPeriod,
  summaryMonth,
} from "../data";
import { ReceiptSheet } from "./receipt-sheet";

const PERIODS = ["todo", "mes", "pasado"] as const;

/**
 * The interactive heart of the Historial screen: the month summary (counts up),
 * the period filter chips, the purchases grouped by day (each row stagger-fades
 * in), and a bottom Drawer with the itemized receipt. Filter + open-receipt
 * state lives in the URL via nuqs (`?p=` / `?o=`) so views survive a reload and
 * can be deep-linked. Client component.
 */
export function HistoryView() {
  const t = useTranslations("History");
  const reduced = useReducedMotion();

  const [q, setQ] = useQueryStates({
    p: parseAsStringLiteral(PERIODS).withDefault("todo"),
    o: parseAsString,
  });

  const summary = useMemo(() => monthSummary(), []);
  const groups = useMemo(() => groupByDay(ordersForPeriod(q.p)), [q.p]);
  const selected = q.o ? orderById(q.o) : null;

  const chips: { key: Period; label: string }[] = [
    { key: "todo", label: t("periodAll") },
    { key: "mes", label: t("periodMonth") },
    { key: "pasado", label: t("periodLast") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <style>{`@keyframes tw-fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>

      {/* Month summary */}
      <section className="from-primary to-primary/70 shadow-primary/30 relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-4 -bottom-6 rotate-[-12deg] text-8xl opacity-15"
        >
          🧾
        </span>
        <div className="relative">
          <div className="text-xs font-extrabold tracking-widest text-white/80">
            {t("summaryHeading", { month: summaryMonth })}
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <SummaryStat label={t("statVisits")} value={summary.visits} />
            <SummaryStat label={t("statPoints")} value={summary.points} plus />
            <SummaryStat label={t("statSellos")} value={summary.sellos} plus />
          </div>
        </div>
      </section>

      {/* Period filters */}
      <div className="-mx-1 -mt-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => {
          const active = q.p === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => void setQ({ p: chip.key })}
              aria-pressed={active}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Grouped orders — keyed by period so the list re-animates on filter change. */}
      {groups.length === 0 ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-14 text-center">
          <div className="mb-2 text-4xl">🧾</div>
          <p className="text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div key={q.p} className="flex flex-col gap-6">
          {groups.map((g, gi) => (
            <section key={g.label}>
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-foreground text-xs font-extrabold tracking-wide">
                  {g.label}
                </span>
                <span className="text-muted-foreground text-xs font-bold">
                  {t("countOrders", { count: g.count })}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {g.orders.map((o, oi) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    index={gi + oi}
                    reduced={reduced}
                    onOpen={() => void setQ({ o: o.id })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(next) => !next && void setQ({ o: null })}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {selected ? <ReceiptSheet order={selected} /> : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  plus = false,
}: {
  label: string;
  value: number;
  plus?: boolean;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-white/15 p-3">
      <div className="text-[0.625rem] font-extrabold tracking-wide text-white/80">
        {label}
      </div>
      <CountUp
        value={value}
        plus={plus}
        className="font-display mt-1.5 block text-2xl leading-none font-semibold text-white"
      />
    </div>
  );
}

function OrderRow({
  order,
  index,
  reduced,
  onOpen,
}: {
  order: Order;
  index: number;
  reduced: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={
        reduced
          ? undefined
          : {
              animation: "tw-fade-up 0.45s ease-out backwards",
              animationDelay: `${index * 60}ms`,
            }
      }
      className="bg-card flex w-full items-center gap-3 rounded-3xl p-3.5 text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10"
    >
      <span className="grid size-[3.125rem] flex-none place-items-center rounded-2xl bg-gradient-to-br from-[#f1fffb] to-[#d6f6ed] text-2xl">
        {order.emoji}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground truncate text-[0.95rem] font-bold">
          {orderSummary(order)}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {order.store} · {order.time}
        </span>
        <div className="mt-1 flex gap-1.5">
          <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-extrabold">
            +{order.points} pts
          </span>
          <span className="bg-primary/10 inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-extrabold text-[#3f7d72]">
            🧋 +{order.sellos}
          </span>
        </div>
      </div>
      <div className="flex flex-none flex-col items-end gap-0.5">
        <span className="font-display text-foreground text-lg font-semibold">
          {order.total}
        </span>
        <ChevronRight className="text-muted-foreground/50 size-4" />
      </div>
    </button>
  );
}
