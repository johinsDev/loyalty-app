"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const money = (cents: number) => cop.format(Math.round(cents / 100));

/**
 * Real promo performance for the dashboard (last 30 days): top promos by usage
 * with the discount each gave away, linking into the Analytics section. Replaces
 * the hardcoded demo `promoPerformance` block.
 */
export function DashboardPromoCard({ style }: { style?: React.CSSProperties }) {
  const t = useTranslations("Dashboard");
  const ta = useTranslations("Promotions.analytics");
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.promociones.analytics.queryOptions({}));

  const top = data?.top.slice(0, 5) ?? [];
  const max = top.reduce((m, p) => Math.max(m, p.uses), 0) || 1;

  return (
    <div style={style} className="bg-card min-w-0 rounded-3xl border p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="text-primary size-4" />
            {t("promoPerfTitle")}
          </h2>
          <p className="text-muted-foreground/80 mt-0.5 text-xs font-semibold">
            {t("promoPerfSubtitle")}
          </p>
        </div>
        <Link
          href="/analytics/promotions"
          className="text-primary inline-flex flex-none items-center gap-1 text-xs font-semibold hover:underline"
        >
          {ta("viewAll")}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-8 rounded-lg" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="text-muted-foreground text-sm">{ta("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {top.map((p) => (
            <li key={p.id}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <Link
                  href={{ pathname: "/promotions/[id]", params: { id: p.id } }}
                  className="truncate font-bold hover:underline"
                >
                  {p.name || ta("untitled")}
                </Link>
                <span className="text-muted-foreground flex-none font-semibold">
                  {p.uses.toLocaleString("es-CO")} · {money(p.discountCents)}
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <span
                  className="from-primary to-primary/60 block h-full rounded-full bg-gradient-to-r"
                  style={{ width: `${(p.uses / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
