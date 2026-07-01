"use client";

import { Button, Input, Label, Switch } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Global "Smart Delivery" rules — the per-org frequency cap + quiet-hours window
 * applied to promotional campaign sends. Backed by `settings.smartDelivery`.
 */
export function SmartDeliveryRules() {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.settings.smartDelivery.queryOptions());
  const update = useMutation(trpc.settings.updateSmartDelivery.mutationOptions());

  const [capOn, setCapOn] = useState(false);
  const [cap, setCap] = useState("3");
  const [quietOn, setQuietOn] = useState(false);
  const [start, setStart] = useState("21:00");
  const [end, setEnd] = useState("09:00");

  useEffect(() => {
    const d = query.data;
    if (!d) return;
    setCapOn(d.frequencyCapPerWeek != null);
    if (d.frequencyCapPerWeek != null) setCap(String(d.frequencyCapPerWeek));
    setQuietOn(d.quietHoursStart != null && d.quietHoursEnd != null);
    if (d.quietHoursStart) setStart(d.quietHoursStart);
    if (d.quietHoursEnd) setEnd(d.quietHoursEnd);
  }, [query.data]);

  const onSave = () => {
    const capValue = capOn ? Math.max(1, Math.min(50, Number(cap) || 1)) : null;
    update.mutate(
      {
        frequencyCapPerWeek: capValue,
        quietHoursStart: quietOn ? start : null,
        quietHoursEnd: quietOn ? end : null,
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(trpc.settings.smartDelivery.queryFilter());
          toast.success(t("rulesSaved"));
        },
        onError: () => toast.error(t("saveError")),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6 lg:px-8">
      <Link
        href="/campaigns"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("rulesTitle")}</h1>
      <p className="text-muted-foreground text-sm">{t("rulesSubtitle")}</p>

      <div className="mt-6 space-y-5">
        <section className="bg-card border-border space-y-3 rounded-3xl border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="font-semibold">{t("capLabel")}</Label>
              <p className="text-muted-foreground text-xs">{t("capHint")}</p>
            </div>
            <Switch checked={capOn} onCheckedChange={setCapOn} />
          </div>
          {capOn ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={50}
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className="h-10 w-24"
              />
              <span className="text-muted-foreground text-sm">{t("capUnit")}</span>
            </div>
          ) : null}
        </section>

        <section className="bg-card border-border space-y-3 rounded-3xl border p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="font-semibold">{t("quietLabel")}</Label>
              <p className="text-muted-foreground text-xs">{t("quietHint")}</p>
            </div>
            <Switch checked={quietOn} onCheckedChange={setQuietOn} />
          </div>
          {quietOn ? (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-10 w-44"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-10 w-44"
              />
            </div>
          ) : null}
        </section>

        <Button
          className="h-10 rounded-xl px-6 font-semibold"
          onClick={onSave}
          disabled={update.isPending}
        >
          {t("rulesSave")}
        </Button>
      </div>
    </div>
  );
}
