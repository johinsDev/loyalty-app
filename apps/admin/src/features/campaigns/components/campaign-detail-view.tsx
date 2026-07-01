"use client";

import type { AppRouter } from "@loyalty/api";
import { formatDate } from "@loyalty/date";
import { Badge, Button } from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Pencil, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { CampaignMessagePreview, type PreviewMessage } from "./campaign-message-preview";

type CampaignDetail = NonNullable<inferRouterOutputs<AppRouter>["campaigns"]["detail"]>;
type CampaignDisplayState = CampaignDetail["displayState"];

const STATE_STYLE: Record<CampaignDisplayState, string> = {
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  sending: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  paused: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

/** Message row → the preview's full-channel shape (missing channels = empty). */
function toPreviewMessage(message: CampaignDetail["message"]): PreviewMessage {
  return {
    push: { title: message?.push?.title ?? "", body: message?.push?.body ?? "" },
    email: { subject: message?.email?.subject ?? "", body: message?.email?.body ?? "" },
    sms: { text: message?.sms?.text ?? "" },
    whatsapp: { text: message?.whatsapp?.text ?? "" },
  };
}

/**
 * Read-only campaign summary — the `?detalle=` modal (over the list) and the full
 * `/campaigns/[id]` page. Shows the message preview, audience + channel priority,
 * schedule, and the send funnel (Enviados / Omitidos / Fallidos). "Editar" is
 * available while the campaign is still a draft.
 */
export function CampaignDetailView({
  campaign,
  variant = "page",
}: {
  campaign: CampaignDetail;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const state = campaign.displayState;

  const retry = useMutation(trpc.campaigns.retry.mutationOptions());
  const onRetry = () =>
    retry.mutate(
      { id: campaign.id },
      {
        onSuccess: async (res) => {
          toast.success(t("retried", { n: res.recipients }));
          await queryClient.invalidateQueries(trpc.campaigns.detail.queryFilter({ id: campaign.id }));
          await queryClient.invalidateQueries(trpc.campaigns.adminList.queryFilter());
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display truncate text-xl font-semibold tracking-tight">
          {campaign.name || t("namePlaceholder")}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge className={`border-0 ${STATE_STYLE[state]}`}>{t(`state.${state}`)}</Badge>
          <Badge variant="outline">{t(`type.${campaign.type}`)}</Badge>
        </div>
      </div>
      {state === "draft" ? (
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1.5 rounded-xl"
          onClick={() =>
            router.push({ pathname: "/campaigns/[id]/edit", params: { id: campaign.id } })
          }
        >
          <Pencil className="size-4" />
          {t("edit")}
        </Button>
      ) : null}
    </div>
  );

  const previewBlock = (
    <section className="space-y-2">
      <SectionLabel>{t("messageLabel")}</SectionLabel>
      <CampaignMessagePreview
        message={toPreviewMessage(campaign.message)}
        channelPriority={campaign.channelPriority as ("push" | "email" | "sms" | "whatsapp")[]}
      />
    </section>
  );

  const audienceBlock = (
    <section className="space-y-2">
      <SectionLabel>{t("audienceLabel")}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {audienceChips(campaign.audienceFilter, t).map((chip, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Badge key={i} variant="secondary">
            {chip}
          </Badge>
        ))}
      </div>
    </section>
  );

  const channelsBlock = (
    <section className="space-y-2">
      <SectionLabel>{t("colChannels")}</SectionLabel>
      {campaign.channelPriority.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {campaign.channelPriority.map((c, i) => (
            <span key={c} className="flex items-center gap-1.5">
              {i > 0 ? <span className="text-muted-foreground/50 text-xs">›</span> : null}
              <Badge variant="outline">{t(`channel.${c}`)}</Badge>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">—</p>
      )}
      <p className="text-muted-foreground text-xs">{t("channelsPriorityHint")}</p>
    </section>
  );

  const scheduleBlock = (
    <dl className="text-muted-foreground grid grid-cols-2 gap-y-1 text-sm">
      <dt>{t("scheduleLabel")}</dt>
      <dd className="text-right">
        {campaign.scheduledAt ? formatDate(campaign.scheduledAt, { locale }) : t("sendNow")}
      </dd>
      {campaign.sentAt ? (
        <>
          <dt>{t("sentAtLabel")}</dt>
          <dd className="text-right">{formatDate(campaign.sentAt, { locale })}</dd>
        </>
      ) : null}
      {campaign.special ? (
        <>
          <dt>{t("specialLabel")}</dt>
          <dd className="text-right">{t("specialOn")}</dd>
        </>
      ) : null}
      <dt>{t("colCreated")}</dt>
      <dd className="text-right">{formatDate(campaign.createdAt, { locale })}</dd>
    </dl>
  );

  const funnelBlock = (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>{t("funnelTitle")}</SectionLabel>
        {campaign.funnel.failed > 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive h-8 gap-1.5 rounded-lg"
            onClick={onRetry}
            disabled={retry.isPending}
          >
            <RotateCcw className="size-3.5" />
            {t("retry")}
          </Button>
        ) : null}
      </div>
      <FunnelBars funnel={campaign.funnel} />
      <ChannelBreakdown byChannel={campaign.funnel.byChannel} />
      {Object.keys(campaign.funnel.skipReasons).length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-muted-foreground space-y-1 text-xs">
            {Object.entries(campaign.funnel.skipReasons).map(([reason, n]) => (
              <div key={reason} className="flex items-center justify-between">
                <span>{skipReasonLabel(reason, t)}</span>
                <span className="font-semibold">{n}</span>
              </div>
            ))}
          </div>
          {campaign.funnel.skipReasons["no-channel"] ? (
            <p className="text-muted-foreground/80 text-xs">{t("skipReasonsHint")}</p>
          ) : null}
        </div>
      ) : null}
      {campaign.failures.length > 0 ? (
        <div className="bg-card border-border divide-border divide-y rounded-2xl border">
          {campaign.failures.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {f.channel ? t(`channel.${f.channel}`) : t("channelUnknown")}
                </p>
                <p className="text-muted-foreground truncate text-xs" title={f.error ?? undefined}>
                  {f.error ?? t("errorUnknown")}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatDate(f.createdAt, { locale })}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );

  if (variant === "modal") {
    return (
      <div className="max-h-[85dvh] space-y-5 overflow-y-auto p-5">
        {header}
        {funnelBlock}
        {previewBlock}
        {channelsBlock}
        {audienceBlock}
        {scheduleBlock}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {funnelBlock}
          {previewBlock}
        </div>
        <div className="bg-card border-border h-fit space-y-5 rounded-3xl border p-5 shadow-sm">
          {channelsBlock}
          <div className="border-border border-t pt-4">{audienceBlock}</div>
          <div className="border-border border-t pt-4">{scheduleBlock}</div>
        </div>
      </div>
    </div>
  );
}

function FunnelBars({ funnel }: { funnel: CampaignDetail["funnel"] }) {
  const t = useTranslations("Campaigns");
  const max = Math.max(
    1,
    funnel.sent,
    funnel.clicked,
    funnel.redeemed ?? 0,
    funnel.skipped,
    funnel.failed,
  );
  // Conversion rate relative to Enviados (the funnel's entry stage).
  const rate = (v: number) =>
    funnel.sent > 0 ? Math.round((v / funnel.sent) * 100) : null;
  const stages: {
    key: string;
    value: number;
    bar: string;
    text: string;
    pct?: number | null;
  }[] = [
    { key: "sent", value: funnel.sent, bar: "bg-emerald-500", text: "text-emerald-600" },
    { key: "clicked", value: funnel.clicked, bar: "bg-blue-500", text: "text-blue-600", pct: rate(funnel.clicked) },
    // Canjeados — only when the campaign links a redeemable offer.
    ...(funnel.redeemed != null
      ? [{ key: "redeemed", value: funnel.redeemed, bar: "bg-teal-500", text: "text-teal-600", pct: rate(funnel.redeemed) }]
      : []),
    { key: "skipped", value: funnel.skipped, bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
    { key: "failed", value: funnel.failed, bar: "bg-destructive", text: "text-destructive" },
  ];
  return (
    <div className="space-y-2.5">
      {stages.map((s) => (
        <div key={s.key} className="space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">{t(`funnel.${s.key}`)}</span>
            <span className={s.text}>
              {s.value.toLocaleString()}
              {s.pct != null ? (
                <span className="text-muted-foreground ml-1 font-medium">· {s.pct}%</span>
              ) : null}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${s.bar}`}
              style={{ width: `${(s.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Where successful sends actually landed (first reachable channel per user). */
function ChannelBreakdown({ byChannel }: { byChannel: Record<string, number> }) {
  const t = useTranslations("Campaigns");
  const entries = Object.entries(byChannel).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-muted-foreground text-xs font-semibold">{t("byChannelTitle")}</p>
      {entries.map(([ch, n]) => (
        <div key={ch} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-20 shrink-0">{t(`channel.${ch}`)}</span>
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${total > 0 ? (n / total) * 100 : 0}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-semibold">{n}</span>
        </div>
      ))}
    </div>
  );
}

/** Known skip reasons the send job/notifier can emit → friendly labels. */
const KNOWN_SKIP_REASONS = new Set([
  "no-channel",
  "opted-out",
  "capped",
  "no-contact",
  "no-method",
  "not-registered",
]);
function skipReasonLabel(
  reason: string,
  t: ReturnType<typeof useTranslations>,
): string {
  return KNOWN_SKIP_REASONS.has(reason) ? t(`skipReason.${reason}`) : t("skipReason.unknown");
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">{children}</p>
  );
}

/** Human-readable chips for the inline audience filter (empty = everyone). */
function audienceChips(
  filter: CampaignDetail["audienceFilter"],
  t: ReturnType<typeof useTranslations>,
): string[] {
  if (!filter) return [t("audienceEveryone")];
  const chips: string[] = [];
  if (filter.tiers && filter.tiers.length > 0) {
    chips.push(`${t("audienceTiers")}: ${filter.tiers.join(", ")}`);
  }
  if (filter.lastPurchase) {
    const op = filter.lastPurchase.op === "gte" ? "≥" : "≤";
    chips.push(`${t("audienceLastPurchase")} ${op} ${filter.lastPurchase.days}d`);
  }
  if (filter.minPurchases) {
    chips.push(`${t("audienceMinPurchases")}: ${filter.minPurchases}`);
  }
  if (filter.signedUpAfter) {
    chips.push(`${t("audienceSignedUpAfter")}`);
  }
  if (filter.signedUpBefore) {
    chips.push(`${t("audienceSignedUpBefore")}`);
  }
  return chips.length > 0 ? chips : [t("audienceEveryone")];
}
