"use client";

import type { LoyaltyConfigAdminView } from "@loyalty/api/features/settings/schemas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  NumberInput,
  POINTS_CARD_TEMPLATES,
  PointsCardTemplate,
  type PointsCardView,
  Skeleton,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Sparkles, Stamp } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

type Mode = LoyaltyConfigAdminView["mode"];
type Rates = Record<string, { per: number; points: number }>;

const MODES: { key: Mode; icon: typeof Coins }[] = [
  { key: "stamps", icon: Stamp },
  { key: "points", icon: Coins },
  { key: "both", icon: Sparkles },
];

const earnsPoints = (m: Mode) => m !== "stamps";
const earnsStamps = (m: Mode) => m !== "points";

const templateName = (key: string, locale: string): string => {
  const tpl = POINTS_CARD_TEMPLATES.find((x) => x.key === key);
  return tpl ? tpl.name[locale === "en" ? "en" : "es"] : key;
};

/** Same floor math as the server's `pointsForPrice` — keep in sync. */
const pointsFor = (cents: number, rate: { per: number; points: number }): number =>
  Math.floor(Math.floor(cents / 100) / rate.per) * rate.points;

/**
 * Ajustes → Lealtad: the loyalty mode (stamps / points / both — the invalid
 * "all off" state is unrepresentable), the per-currency points equivalence, and
 * a live insights panel that shows what the rate means against real rewards and
 * ticket sizes. Pausing a track asks for confirmation (customers get notified).
 */
export function LoyaltySection() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data } = useQuery(trpc.settings.loyaltyConfigAdmin.queryOptions());
  const insights = useQuery(trpc.settings.loyaltyInsights.queryOptions());

  const [mode, setMode] = useState<Mode | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Seed once from the server config (brand-section pattern).
  useEffect(() => {
    if (!data || mode !== null) return;
    setMode(data.mode);
    setRates(data.pointsRates);
    setTemplate(data.pointsCardTemplate);
  }, [data, mode]);

  const save = useMutation(
    trpc.settings.updateLoyaltyConfig.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.settings.loyaltyConfigAdmin.queryFilter()),
          queryClient.invalidateQueries(trpc.settings.loyaltyConfig.queryFilter()),
        ]);
        toast.success(t("saved"));
      },
      onError: (err) => {
        if (err.message.startsWith("LOYALTY_RATE_MISSING")) {
          toast.error(t("loyalty.errRateMissing"));
        } else {
          toast.error(t("loyalty.error"));
        }
      },
    }),
  );

  if (!data || mode === null || rates === null || template === null) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  const setRate = (currency: string, field: "per" | "points", value: number) =>
    setRates((prev) => ({
      ...prev!,
      [currency]: { ...prev![currency]!, [field]: Math.max(1, Math.round(value || 1)) },
    }));

  // Pausing = a track earns under the SAVED mode but not under the new one.
  const pausesPoints = earnsPoints(data.mode) && !earnsPoints(mode);
  const pausesStamps = earnsStamps(data.mode) && !earnsStamps(mode);
  const pausesSomething = pausesPoints || pausesStamps;

  const doSave = () => {
    setConfirmOpen(false);
    save.mutate({ mode, pointsRates: rates, pointsCardTemplate: template });
  };
  const onSave = () => {
    if (pausesSomething) setConfirmOpen(true);
    else doSave();
  };

  const currencies = Object.keys(rates);
  const sampleView: PointsCardView = {
    balance: 1240,
    formatBalance: (n) => format.number(n),
    tierName: t("loyalty.templates.sampleTier"),
    tierColor: "#f0a868",
    tierIconKey: "flower",
    progress: 0.68,
    nextTierName: t("loyalty.templates.sampleNext"),
    nextThreshold: 1200,
    nextLabel: t("loyalty.templates.sampleNextLabel"),
    maxLabel: "",
    pausedLabel: null,
    detailAriaLabel: "",
  };
  const pointsRewards = insights.data?.pointsRewards ?? [];
  const multiplierPromos = insights.data?.multiplierPromos ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("loyalty.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("loyalty.desc")}</p>
      </div>

      {/* Mode */}
      <div className="space-y-2">
        <span className="text-sm font-bold">{t("loyalty.mode")}</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MODES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                mode === key
                  ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <Icon className={`size-5 ${mode === key ? "text-primary" : "text-muted-foreground"}`} />
              <div className="mt-2 font-bold">{t(`loyalty.modeOpt.${key}`)}</div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t(`loyalty.modeDesc.${key}`)}
              </p>
            </button>
          ))}
        </div>
        {pausesSomething ? (
          <p className="text-sm font-semibold text-amber-600">
            {pausesPoints ? t("loyalty.willPausePoints") : t("loyalty.willPauseStamps")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Equivalence */}
        <div className="space-y-3">
          <div>
            <span className="text-sm font-bold">{t("loyalty.equivalence")}</span>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("loyalty.equivalenceHint")}
            </p>
          </div>
          {currencies.map((currency) => (
            <div
              key={currency}
              className={`border-border flex flex-wrap items-center gap-2 rounded-2xl border p-3 ${
                earnsPoints(mode) ? "" : "opacity-50"
              }`}
            >
              <span className="text-sm">{t("loyalty.ratePrefix")}</span>
              <NumberInput
                value={rates[currency]!.per}
                onValueChange={(v) => setRate(currency, "per", v ?? 1)}
                className="h-10 w-28"
                disabled={!earnsPoints(mode)}
              />
              <Badge variant="outline">{currency}</Badge>
              <span className="text-sm">→</span>
              <NumberInput
                value={rates[currency]!.points}
                onValueChange={(v) => setRate(currency, "points", v ?? 1)}
                className="h-10 w-24"
                disabled={!earnsPoints(mode)}
              />
              <span className="text-sm">{t("loyalty.ratePoints")}</span>
            </div>
          ))}
        </div>

        {/* Live insights */}
        <div className="bg-muted/40 border-border space-y-4 rounded-2xl border p-4">
          <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
            {t("loyalty.insights.title")}
          </span>
          {insights.isPending ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : !earnsPoints(mode) ? (
            <p className="text-muted-foreground text-sm">{t("loyalty.insights.pointsOff")}</p>
          ) : (
            currencies.map((currency) => {
              const info = insights.data?.perCurrency.find((c) => c.currency === currency);
              const rate = rates[currency]!;
              const avg = info?.avgTicketCents ?? null;
              const perPurchase = avg != null ? pointsFor(avg, rate) : null;
              return (
                <div key={currency} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{currency}</Badge>
                    {avg != null ? (
                      <span className="text-muted-foreground text-xs font-semibold">
                        {t(
                          info!.source === "purchases"
                            ? "loyalty.insights.avgTicket"
                            : "loyalty.insights.avgCatalog",
                          { amount: money(format, avg, currency) },
                        )}
                        {" · "}
                        {t("loyalty.insights.perPurchase", {
                          n: format.number(perPurchase ?? 0),
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {t("loyalty.insights.noData")}
                      </span>
                    )}
                  </div>
                  {perPurchase != null && pointsRewards.length > 0 ? (
                    <ul className="space-y-1.5">
                      {pointsRewards.map((r) => {
                        const purchases =
                          perPurchase > 0 ? Math.ceil(r.pointsCost / perPurchase) : null;
                        const tone =
                          purchases === null || purchases > 30
                            ? "bg-red-500"
                            : purchases > 10
                              ? "bg-amber-500"
                              : "bg-emerald-500";
                        return (
                          <li key={r.id} className="flex items-center gap-2 text-sm">
                            <span className={`size-2 flex-none rounded-full ${tone}`} />
                            <span className="min-w-0 flex-1 truncate">
                              {r.icon ? `${r.icon} ` : ""}
                              {r.name}{" "}
                              <span className="text-muted-foreground">
                                ({format.number(r.pointsCost)} pts)
                              </span>
                            </span>
                            <span className="font-bold whitespace-nowrap">
                              {purchases === null
                                ? t("loyalty.insights.unreachable")
                                : t("loyalty.insights.purchases", { n: purchases })}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })
          )}
          {earnsPoints(mode) && multiplierPromos.length > 0 ? (
            <p className="text-muted-foreground border-border border-t pt-3 text-xs">
              ⚡{" "}
              {t("loyalty.insights.multiplier", {
                names: multiplierPromos
                  .map((p) => `${p.name} (${p.multiplier}×)`)
                  .join(", "),
              })}
            </p>
          ) : null}
        </div>
      </div>

      {/* Points-card template gallery — the previews ARE the customer render
          (shared PointsCardTemplate), on sample data. */}
      <div className="space-y-3">
        <div>
          <span className="text-sm font-bold">{t("loyalty.templates.title")}</span>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {t("loyalty.templates.hint")}
          </p>
        </div>
        {/* `.preview-customer` re-themes --primary etc. to the tenant brand, so
            these previews render in the STORE's colors, not the admin violet. */}
        <div className="preview-customer grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-start">
          <div className="space-y-2">
            <PointsCardTemplate template={template} view={sampleView} />
            <p className="text-muted-foreground text-center text-xs font-bold">
              {templateName(template, locale)}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label={t("loyalty.templates.title")}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
          >
            {POINTS_CARD_TEMPLATES.map((tpl) => {
              const selected = template === tpl.key;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTemplate(tpl.key)}
                  className={`group rounded-2xl text-left outline-none ${
                    selected ? "" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`bg-muted/40 relative h-24 overflow-hidden rounded-2xl transition-shadow ${
                      selected
                        ? "ring-primary ring-2"
                        : "ring-border group-hover:ring-primary/40 ring-1"
                    }`}
                  >
                    <div className="pointer-events-none absolute top-0 left-1/2 w-[320px] origin-top -translate-x-1/2 scale-50 p-2">
                      <PointsCardTemplate template={tpl.key} view={sampleView} />
                    </div>
                    {selected ? (
                      <span className="bg-primary absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full text-white shadow-sm">
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`mt-1 truncate text-center text-xs font-bold ${
                      selected ? "" : "text-muted-foreground"
                    }`}
                  >
                    {tpl.name[locale === "en" ? "en" : "es"]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        onClick={onSave}
        disabled={save.isPending}
        className="h-10 rounded-xl px-6 font-semibold"
      >
        {t("save")}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pausesPoints ? t("loyalty.confirmPointsTitle") : t("loyalty.confirmStampsTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {pausesPoints
                  ? t("loyalty.confirmPointsBody")
                  : t("loyalty.confirmStampsBody")}
              </span>
              {pausesPoints && pointsRewards.length > 0 ? (
                <span className="block">
                  {t("loyalty.confirmPointsRewards", { n: pointsRewards.length })}
                </span>
              ) : null}
              {pausesPoints && multiplierPromos.length > 0 ? (
                <span className="block">
                  {t("loyalty.confirmMultiplier", { n: multiplierPromos.length })}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 px-4">{t("loyalty.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="h-10 px-4">
              {t("loyalty.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
