"use client";

import type { AppRouter } from "@loyalty/api";
import { formatDate } from "@loyalty/date";
import { Badge, Button } from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Pencil, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { BannerStatsChart } from "./banner-stats-chart";

type BannerDetail = NonNullable<inferRouterOutputs<AppRouter>["banners"]["detail"]>;
type BannerState = "draft" | "scheduled" | "active" | "expired";

const STATE_STYLE: Record<BannerState, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  expired: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/**
 * Read-only banner summary — rendered as the `?detalle=` modal (over the list)
 * and as the full `/banners/[id]` page. Shows the rendered banner preview,
 * schedule and CTR stats. "Editar" → `/banners/[id]/edit`.
 */
export function BannerDetailView({
  banner,
  variant = "page",
}: {
  banner: BannerDetail;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("Banners");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const state = banner.displayState as BannerState;

  const campaigns = useQuery(
    trpc.campaigns.campaignsBySource.queryOptions({ scope: "banner", id: banner.id }),
  );

  const campaignsBlock = (
    <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <h3 className="font-display mb-3 text-sm font-semibold">
        {t("campaigns.title", { n: campaigns.data?.length ?? 0 })}
      </h3>
      {campaigns.isPending ? (
        <div className="bg-muted/50 h-5 w-40 animate-pulse rounded" />
      ) : campaigns.data && campaigns.data.length > 0 ? (
        <ul className="divide-border divide-y">
          {campaigns.data.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <Link
                href={{ pathname: "/campaigns/[id]", params: { id: c.id } }}
                className="text-sm hover:underline"
              >
                {c.name ?? t("campaigns.untitled")}
              </Link>
              <span className="text-muted-foreground text-xs">
                {t(`campaigns.status.${c.status === "published" ? "published" : "draft"}`)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("campaigns.empty")}</p>
      )}
    </section>
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display truncate text-xl font-semibold tracking-tight">
          {banner.name || t("namePlaceholder")}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge className={`border-0 ${STATE_STYLE[state]}`}>{t(`state.${state}`)}</Badge>
          <span className="text-muted-foreground font-mono text-xs">/{banner.slug}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-9 shrink-0 gap-1.5 rounded-xl"
        onClick={() => router.push({ pathname: "/banners/[id]/edit", params: { id: banner.id } })}
      >
        <Pencil className="size-4" />
        {t("edit")}
      </Button>
    </div>
  );

  const preview = (
    <div
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm"
      style={{ background: banner.backgroundCss ?? "var(--muted)", minHeight: "9rem" }}
    >
      {/* Foreground main image — mirrors the customer card (right-anchored). */}
      {banner.mainImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.mainImageUrl}
          alt=""
          className="absolute inset-y-3 right-3 z-10 w-2/5 object-contain object-right"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
      <div className="relative z-20 flex h-full flex-col justify-end">
        <p className="font-display text-lg font-semibold drop-shadow">{banner.name}</p>
        {banner.shortDescription ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-white/90 drop-shadow">
            {banner.shortDescription}
          </p>
        ) : null}
        {banner.cta ? (
          <span className="bg-card text-foreground mt-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold">
            {banner.cta.label || t("fieldCta")}
          </span>
        ) : null}
      </div>
    </div>
  );

  const scheduleBlock = (
    <dl className="text-muted-foreground grid grid-cols-2 gap-y-1 text-sm">
      <dt>{t("fieldStart")}</dt>
      <dd className="text-right">
        {banner.displayFrom ? formatDate(banner.displayFrom, { locale }) : t("scheduleAlways")}
      </dd>
      <dt>{t("fieldEnd")}</dt>
      <dd className="text-right">
        {banner.displayUntil ? formatDate(banner.displayUntil, { locale }) : t("noEnd")}
      </dd>
      <dt>{t("colCreated")}</dt>
      <dd className="text-right">{formatDate(banner.createdAt, { locale })}</dd>
    </dl>
  );

  const kpis = (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <Kpi icon={<Users className="size-4" />} label={t("statImpressions")} value={banner.stats.impressions} />
      <Kpi
        icon={<MousePointerClick className="size-4" />}
        label={t("statClicks")}
        value={banner.stats.clicks}
      />
      <Kpi label={t("statCtr")} value={pct(banner.stats.ctr)} />
    </div>
  );

  const statsBlock = (
    <section className="space-y-3">
      <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
        {t("statsTitle")}
      </p>
      {kpis}
      {banner.stats.series.length > 0 ? (
        <BannerStatsChart
          series={banner.stats.series}
          labels={{ impressions: t("statImpressions"), clicks: t("statClicks") }}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{t("statsEmpty")}</p>
      )}
    </section>
  );

  if (variant === "modal") {
    return (
      <div className="max-h-[85dvh] space-y-5 overflow-y-auto p-5">
        {header}
        {preview}
        {statsBlock}
        {scheduleBlock}
        {campaignsBlock}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {preview}
          {statsBlock}
        </div>
        <div className="h-fit space-y-5">
          <div className="bg-card border-border space-y-5 rounded-3xl border p-5 shadow-sm">
            {scheduleBlock}
          </div>
          {campaignsBlock}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-card border-border rounded-2xl border p-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
        {icon}
        {label}
      </p>
      <p className="font-display mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
